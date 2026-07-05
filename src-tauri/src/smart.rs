use serde::Serialize;
use std::collections::HashMap;
use wmi::{COMLibrary, Variant, WMIConnection};

#[derive(Serialize, Clone)]
pub struct SmartAttr {
    pub id: u8,
    pub name: String,
    pub current: u8,
    pub worst: u8,
    pub raw: u64,
}

#[derive(Serialize)]
pub struct DriveHealth {
    pub device_id: String,
    pub model: String,
    pub serial: String,
    pub size: u64,
    pub media_type: String,
    pub bus_type: String,
    pub health_pct: u8,
    pub health_status: String,
    pub predict_fail: bool,
    pub temp_c: Option<u16>,
    pub wear_pct: Option<u8>,
    pub power_on_hours: Option<u64>,
    pub read_errors: Option<u64>,
    pub write_errors: Option<u64>,
    pub attrs: Vec<SmartAttr>,
}

pub fn variant_u64(v: &Variant) -> Option<u64> {
    match v {
        Variant::UI1(x) => Some(*x as u64),
        Variant::UI2(x) => Some(*x as u64),
        Variant::UI4(x) => Some(*x as u64),
        Variant::UI8(x) => Some(*x),
        Variant::I1(x) => Some(*x as u64),
        Variant::I2(x) => Some(*x as u64),
        Variant::I4(x) => Some(*x as u64),
        Variant::I8(x) => Some(*x as u64),
        Variant::R4(x) => Some(*x as u64),
        Variant::R8(x) => Some(*x as u64),
        Variant::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn variant_str(v: &Variant) -> Option<String> {
    match v {
        Variant::String(s) => Some(s.trim().to_string()),
        _ => None,
    }
}

fn variant_bool(v: &Variant) -> Option<bool> {
    match v {
        Variant::Bool(b) => Some(*b),
        _ => None,
    }
}

fn variant_bytes(v: &Variant) -> Option<Vec<u8>> {
    match v {
        Variant::Array(arr) => Some(
            arr.iter()
                .filter_map(|x| variant_u64(x).map(|n| n as u8))
                .collect(),
        ),
        _ => None,
    }
}

fn attr_name(id: u8) -> &'static str {
    match id {
        1 => "Read Error Rate",
        3 => "Spin-Up Time",
        4 => "Start/Stop Count",
        5 => "Reallocated Sectors",
        7 => "Seek Error Rate",
        9 => "Power-On Hours",
        10 => "Spin Retry Count",
        12 => "Power Cycle Count",
        170 => "Available Reserved Space",
        173 => "Wear Leveling Count",
        177 => "Wear Leveling Count",
        179 => "Used Reserved Blocks",
        181 => "Program Fail Count",
        182 => "Erase Fail Count",
        184 => "End-to-End Error",
        187 => "Reported Uncorrectable",
        188 => "Command Timeout",
        190 => "Airflow Temperature",
        194 => "Temperature",
        195 => "Hardware ECC Recovered",
        196 => "Reallocation Events",
        197 => "Pending Sectors",
        198 => "Uncorrectable Sectors",
        199 => "UDMA CRC Errors",
        231 => "SSD Life Left",
        233 => "Media Wearout Indicator",
        241 => "Total LBAs Written",
        242 => "Total LBAs Read",
        _ => "Vendor Specific",
    }
}

/// Parse MSStorageDriver_ATAPISmartData VendorSpecific blob:
/// 2-byte version header, then 30 entries x 12 bytes:
/// [id, flags_lo, flags_hi, current, worst, raw0..raw5, reserved]
fn parse_ata_smart(blob: &[u8]) -> Vec<SmartAttr> {
    let mut out = Vec::new();
    if blob.len() < 362 {
        return out;
    }
    for i in 0..30 {
        let off = 2 + i * 12;
        let id = blob[off];
        if id == 0 {
            continue;
        }
        let current = blob[off + 3];
        let worst = blob[off + 4];
        let mut raw: u64 = 0;
        for b in 0..6 {
            raw |= (blob[off + 5 + b] as u64) << (8 * b);
        }
        out.push(SmartAttr {
            id,
            name: attr_name(id).to_string(),
            current,
            worst,
            raw,
        });
    }
    out
}

fn media_type_str(v: u64) -> &'static str {
    match v {
        3 => "HDD",
        4 => "SSD",
        5 => "SCM",
        _ => "Unknown",
    }
}

fn bus_type_str(v: u64) -> &'static str {
    match v {
        1 => "SCSI",
        3 => "ATA",
        7 => "USB",
        8 => "RAID",
        9 => "iSCSI",
        10 => "SAS",
        11 => "SATA",
        12 => "SD",
        13 => "MMC",
        17 => "NVMe",
        _ => "Other",
    }
}

fn raw_of(attrs: &[SmartAttr], id: u8) -> Option<u64> {
    attrs.iter().find(|a| a.id == id).map(|a| a.raw)
}

fn compute_health(
    status_health: u64,
    predict_fail: bool,
    wear: Option<u8>,
    attrs: &[SmartAttr],
) -> u8 {
    let mut score: i32 = 100;
    if let Some(realloc) = raw_of(attrs, 5) {
        score -= (realloc as i32 * 2).min(30);
    }
    if let Some(pending) = raw_of(attrs, 197) {
        score -= (pending as i32 * 4).min(25);
    }
    if let Some(uncorr) = raw_of(attrs, 198) {
        score -= (uncorr as i32 * 4).min(25);
    }
    if let Some(reported) = raw_of(attrs, 187) {
        score -= (reported as i32 * 2).min(15);
    }
    if let Some(w) = wear {
        score = score.min(100 - w.min(100) as i32);
    }
    // SSD life-left style attributes: current value IS the percentage.
    for id in [231u8, 233u8] {
        if let Some(a) = attrs.iter().find(|a| a.id == id) {
            if a.current > 0 && a.current <= 100 {
                score = score.min(a.current as i32);
            }
        }
    }
    if status_health == 1 {
        score = score.min(60); // Windows says Warning
    }
    if status_health == 2 {
        score = score.min(20); // Windows says Unhealthy
    }
    if predict_fail {
        score = score.min(10);
    }
    score.clamp(0, 100) as u8
}

fn query_drives() -> Result<Vec<DriveHealth>, String> {
    let com = COMLibrary::new().map_err(|e| e.to_string())?;

    // Physical disks + reliability counters (works for NVMe + SATA on Win8+).
    let storage = WMIConnection::with_namespace_path("root\\microsoft\\windows\\storage", com)
        .map_err(|e| e.to_string())?;
    let disks: Vec<HashMap<String, Variant>> = storage
        .raw_query("SELECT DeviceId, FriendlyName, SerialNumber, Size, MediaType, BusType, HealthStatus FROM MSFT_PhysicalDisk")
        .map_err(|e| e.to_string())?;
    let reliability: Vec<HashMap<String, Variant>> = storage
        .raw_query("SELECT DeviceId, Temperature, Wear, PowerOnHours, ReadErrorsTotal, WriteErrorsTotal FROM MSFT_StorageReliabilityCounter")
        .unwrap_or_default();

    // Legacy ATA SMART blobs (SATA drives).
    let wmi_ns = WMIConnection::with_namespace_path("root\\wmi", com).ok();
    let (predicts, smart_blobs) = if let Some(conn) = &wmi_ns {
        let p: Vec<HashMap<String, Variant>> = conn
            .raw_query("SELECT InstanceName, PredictFailure FROM MSStorageDriver_FailurePredictStatus")
            .unwrap_or_default();
        let s: Vec<HashMap<String, Variant>> = conn
            .raw_query("SELECT InstanceName, VendorSpecific FROM MSStorageDriver_ATAPISmartData")
            .unwrap_or_default();
        (p, s)
    } else {
        (Vec::new(), Vec::new())
    };

    // ATA blobs are matched to disks by order of appearance — instance names
    // don't map cleanly to MSFT_PhysicalDisk DeviceId, so this is best-effort.
    let parsed_blobs: Vec<Vec<SmartAttr>> = smart_blobs
        .iter()
        .filter_map(|row| row.get("VendorSpecific").and_then(variant_bytes))
        .map(|b| parse_ata_smart(&b))
        .collect();
    let any_predict_fail = predicts.iter().any(|row| {
        row.get("PredictFailure")
            .and_then(variant_bool)
            .unwrap_or(false)
    });

    let mut out = Vec::new();
    for (i, d) in disks.iter().enumerate() {
        let device_id = d
            .get("DeviceId")
            .and_then(variant_str)
            .or_else(|| d.get("DeviceId").and_then(variant_u64).map(|n| n.to_string()))
            .unwrap_or_else(|| i.to_string());
        let rel = reliability.iter().find(|r| {
            r.get("DeviceId")
                .and_then(variant_str)
                .or_else(|| r.get("DeviceId").and_then(variant_u64).map(|n| n.to_string()))
                .map_or(false, |id| id == device_id)
        });

        let health_status = d.get("HealthStatus").and_then(variant_u64).unwrap_or(0);
        let wear = rel
            .and_then(|r| r.get("Wear").and_then(variant_u64))
            .map(|w| w.min(100) as u8);
        let attrs: Vec<SmartAttr> = parsed_blobs.get(i).cloned().unwrap_or_default();

        out.push(DriveHealth {
            device_id: device_id.clone(),
            model: d.get("FriendlyName").and_then(variant_str).unwrap_or_default(),
            serial: d.get("SerialNumber").and_then(variant_str).unwrap_or_default(),
            size: d.get("Size").and_then(variant_u64).unwrap_or(0),
            media_type: media_type_str(d.get("MediaType").and_then(variant_u64).unwrap_or(0))
                .to_string(),
            bus_type: bus_type_str(d.get("BusType").and_then(variant_u64).unwrap_or(0))
                .to_string(),
            health_pct: compute_health(health_status, any_predict_fail, wear, &attrs),
            health_status: match health_status {
                0 => "Healthy",
                1 => "Warning",
                2 => "Unhealthy",
                _ => "Unknown",
            }
            .to_string(),
            predict_fail: any_predict_fail,
            temp_c: rel
                .and_then(|r| r.get("Temperature").and_then(variant_u64))
                .filter(|t| *t > 0 && *t < 120)
                .map(|t| t as u16)
                .or_else(|| {
                    raw_of(&attrs, 194)
                        .map(|t| (t & 0xFF) as u16)
                        .filter(|t| *t > 0 && *t < 120)
                }),
            wear_pct: wear,
            power_on_hours: rel
                .and_then(|r| r.get("PowerOnHours").and_then(variant_u64))
                .filter(|h| *h > 0)
                .or_else(|| raw_of(&attrs, 9).map(|h| h & 0xFFFF_FFFF)),
            read_errors: rel.and_then(|r| r.get("ReadErrorsTotal").and_then(variant_u64)),
            write_errors: rel.and_then(|r| r.get("WriteErrorsTotal").and_then(variant_u64)),
            attrs,
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn get_drive_health() -> Result<Vec<DriveHealth>, String> {
    tauri::async_runtime::spawn_blocking(query_drives)
        .await
        .map_err(|e| e.to_string())?
}
