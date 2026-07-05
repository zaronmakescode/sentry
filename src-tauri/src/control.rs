use serde::Serialize;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command;
use sysinfo::{Pid, ProcessesToUpdate, System};
use winreg::enums::*;
use winreg::RegKey;
use wmi::{COMLibrary, Variant, WMIConnection};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn run_hidden(program: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new(program)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

// ---------- processes ----------

#[tauri::command]
pub async fn kill_process(pid: u32) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);
        match sys.process(Pid::from_u32(pid)) {
            Some(p) => Ok(p.kill()),
            None => Err("process not found".to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- explorer ----------

#[tauri::command]
pub async fn restart_explorer() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        run_hidden("taskkill", &["/F", "/IM", "explorer.exe"])?;
        std::thread::sleep(std::time::Duration::from_millis(500));
        Command::new("explorer.exe")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- standby list purge ----------

#[link(name = "ntdll")]
extern "system" {
    fn NtSetSystemInformation(
        system_information_class: i32,
        system_information: *mut core::ffi::c_void,
        system_information_length: u32,
    ) -> i32;
}

fn enable_privilege(name: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, HANDLE, LUID};
    use windows::Win32::Security::{
        AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
        TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
            &mut token,
        )
        .map_err(|e| e.to_string())?;
        let mut luid = LUID::default();
        let res = LookupPrivilegeValueW(PCWSTR::null(), PCWSTR(wide.as_ptr()), &mut luid);
        if let Err(e) = res {
            let _ = CloseHandle(token);
            return Err(e.to_string());
        }
        let tp = TOKEN_PRIVILEGES {
            PrivilegeCount: 1,
            Privileges: [LUID_AND_ATTRIBUTES {
                Luid: luid,
                Attributes: SE_PRIVILEGE_ENABLED,
            }],
        };
        let res = AdjustTokenPrivileges(token, false, Some(&tp), 0, None, None);
        let _ = CloseHandle(token);
        res.map_err(|e| e.to_string())
    }
}

/// Purge the standby memory list. Returns MB freed (approximate).
#[tauri::command]
pub async fn purge_standby_list() -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut sys = System::new();
        sys.refresh_memory();
        let before = sys.available_memory();

        enable_privilege("SeProfileSingleProcessPrivilege")?;
        const SYSTEM_MEMORY_LIST_INFORMATION: i32 = 80;
        let mut command: u32 = 4; // MemoryPurgeStandbyList
        let status = unsafe {
            NtSetSystemInformation(
                SYSTEM_MEMORY_LIST_INFORMATION,
                &mut command as *mut u32 as *mut core::ffi::c_void,
                std::mem::size_of::<u32>() as u32,
            )
        };
        if status != 0 {
            return Err(format!("NtSetSystemInformation failed: 0x{status:08X}"));
        }

        sys.refresh_memory();
        let after = sys.available_memory();
        Ok(after.saturating_sub(before) / (1024 * 1024))
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- power plans ----------

#[derive(Serialize)]
pub struct PowerPlan {
    pub guid: String,
    pub name: String,
    pub active: bool,
}

#[tauri::command]
pub async fn get_power_plans() -> Result<Vec<PowerPlan>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let out = run_hidden("powercfg", &["/list"])?;
        let mut plans = Vec::new();
        for line in out.lines() {
            let Some(idx) = line.find("GUID:") else { continue };
            let rest = line[idx + 5..].trim();
            let Some((guid, name_part)) = rest.split_once(' ') else { continue };
            let name = name_part
                .trim()
                .trim_start_matches('(')
                .trim_end_matches('*')
                .trim()
                .trim_end_matches(')')
                .to_string();
            plans.push(PowerPlan {
                guid: guid.trim().to_string(),
                name,
                active: line.trim_end().ends_with('*'),
            });
        }
        Ok(plans)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_power_plan(guid: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_hidden("powercfg", &["/setactive", &guid])?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- startup apps ----------

#[derive(Serialize)]
pub struct StartupApp {
    pub name: String,
    pub command: String,
    pub scope: String, // "user" | "machine"
    pub enabled: bool,
}

const RUN_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APPROVED_PATH: &str =
    "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";

fn read_startup_scope(hive: winreg::HKEY, scope: &str) -> Vec<StartupApp> {
    let root = RegKey::predef(hive);
    let mut out = Vec::new();
    let Ok(run) = root.open_subkey_with_flags(RUN_PATH, KEY_READ) else {
        return out;
    };
    let approved = root.open_subkey_with_flags(APPROVED_PATH, KEY_READ).ok();
    for item in run.enum_values().flatten() {
        let (name, _value) = item;
        let command: String = run.get_value(&name).unwrap_or_default();
        let enabled = approved
            .as_ref()
            .and_then(|k| k.get_raw_value(&name).ok())
            .map(|rv| rv.bytes.first().map_or(true, |b| b & 0x01 == 0))
            .unwrap_or(true);
        out.push(StartupApp {
            name,
            command,
            scope: scope.to_string(),
            enabled,
        });
    }
    out
}

#[tauri::command]
pub async fn get_startup_apps() -> Result<Vec<StartupApp>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut apps = read_startup_scope(HKEY_CURRENT_USER, "user");
        apps.extend(read_startup_scope(HKEY_LOCAL_MACHINE, "machine"));
        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(apps)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn toggle_startup_app(name: String, scope: String, enable: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hive = if scope == "machine" {
            HKEY_LOCAL_MACHINE
        } else {
            HKEY_CURRENT_USER
        };
        let root = RegKey::predef(hive);
        let (approved, _) = root
            .create_subkey(APPROVED_PATH)
            .map_err(|e| e.to_string())?;
        let mut bytes = vec![0u8; 12];
        bytes[0] = if enable { 0x02 } else { 0x03 };
        approved
            .set_raw_value(
                &name,
                &winreg::RegValue {
                    bytes,
                    vtype: REG_BINARY,
                },
            )
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- intel: wifi / ping / battery ----------

#[derive(Serialize)]
pub struct WifiInfo {
    pub ssid: String,
    pub signal_pct: u8,
    pub radio: String,
    pub rx_mbps: Option<f32>,
    pub tx_mbps: Option<f32>,
}

#[tauri::command]
pub async fn get_wifi() -> Result<Option<WifiInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let out = run_hidden("netsh", &["wlan", "show", "interfaces"])?;
        let mut map: HashMap<String, String> = HashMap::new();
        for line in out.lines() {
            if let Some((k, v)) = line.split_once(" : ") {
                map.insert(k.trim().to_lowercase(), v.trim().to_string());
            }
        }
        let Some(ssid) = map.get("ssid").filter(|s| !s.is_empty()) else {
            return Ok(None);
        };
        Ok(Some(WifiInfo {
            ssid: ssid.clone(),
            signal_pct: map
                .get("signal")
                .and_then(|s| s.trim_end_matches('%').parse().ok())
                .unwrap_or(0),
            radio: map.get("radio type").cloned().unwrap_or_default(),
            rx_mbps: map
                .get("receive rate (mbps)")
                .and_then(|s| s.parse().ok()),
            tx_mbps: map
                .get("transmit rate (mbps)")
                .and_then(|s| s.parse().ok()),
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn ping_host(host: String) -> Result<Option<u32>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // Only allow hostname/IP-ish input since it feeds a shell command.
        if !host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == ':')
        {
            return Err("invalid host".to_string());
        }
        let out = run_hidden("ping", &["-n", "1", "-w", "1500", &host])?;
        for token in out.split_whitespace() {
            let t = token.trim_end_matches(',');
            if let Some(ms) = t
                .strip_prefix("time=")
                .or_else(|| t.strip_prefix("time<"))
            {
                return Ok(ms.trim_end_matches("ms").parse().ok().or(Some(1)));
            }
        }
        Ok(None)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct BatteryInfo {
    pub charge_pct: u8,
    pub status: String,
}

#[tauri::command]
pub async fn get_battery() -> Result<Option<BatteryInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let com = COMLibrary::new().map_err(|e| e.to_string())?;
        let conn = WMIConnection::new(com).map_err(|e| e.to_string())?;
        let rows: Vec<HashMap<String, Variant>> = conn
            .raw_query("SELECT EstimatedChargeRemaining, BatteryStatus FROM Win32_Battery")
            .unwrap_or_default();
        let Some(row) = rows.first() else {
            return Ok(None);
        };
        let charge = row
            .get("EstimatedChargeRemaining")
            .and_then(crate::smart::variant_u64)
            .unwrap_or(0) as u8;
        let status = match row
            .get("BatteryStatus")
            .and_then(crate::smart::variant_u64)
            .unwrap_or(0)
        {
            1 => "Discharging",
            2 => "On AC",
            3 => "Fully Charged",
            4 => "Low",
            5 => "Critical",
            6..=9 => "Charging",
            _ => "Unknown",
        };
        Ok(Some(BatteryInfo {
            charge_pct: charge.min(100),
            status: status.to_string(),
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}
