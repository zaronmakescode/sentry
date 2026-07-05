use nvml_wrapper::enum_wrappers::device::{Clock, TemperatureSensor};
use nvml_wrapper::Nvml;
use serde::Serialize;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use sysinfo::{Disks, Networks, ProcessesToUpdate, System};

static NVML: OnceLock<Option<Nvml>> = OnceLock::new();

fn nvml() -> Option<&'static Nvml> {
    NVML.get_or_init(|| Nvml::init().ok()).as_ref()
}

#[derive(Serialize)]
pub struct CoreStat {
    pub usage: f32,
    pub freq_mhz: u64,
}

#[derive(Serialize)]
pub struct CpuInfo {
    pub name: String,
    pub usage: f32,
    pub freq_mhz: u64,
    pub cores: Vec<CoreStat>,
    pub temp_c: Option<f32>,
}

#[derive(Serialize)]
pub struct MemInfo {
    pub total: u64,
    pub used: u64,
    pub swap_total: u64,
    pub swap_used: u64,
}

#[derive(Serialize)]
pub struct GpuInfo {
    pub name: String,
    pub usage: Option<u32>,
    pub vram_used: Option<u64>,
    pub vram_total: Option<u64>,
    pub temp_c: Option<u32>,
    pub clock_mhz: Option<u32>,
    pub power_w: Option<f32>,
}

#[derive(Serialize)]
pub struct NetInfo {
    pub name: String,
    pub rx_rate: u64,
    pub tx_rate: u64,
    pub rx_total: u64,
    pub tx_total: u64,
}

#[derive(Serialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount: String,
    pub fs: String,
    pub total: u64,
    pub available: u64,
    pub read_rate: u64,
    pub write_rate: u64,
}

#[derive(Serialize)]
pub struct ProcInfo {
    pub pid: u32,
    pub name: String,
    pub cpu: f32,
    pub mem: u64,
}

#[derive(Serialize)]
pub struct Snapshot {
    pub cpu: CpuInfo,
    pub mem: MemInfo,
    pub gpu: Option<GpuInfo>,
    pub nets: Vec<NetInfo>,
    pub disks: Vec<DiskInfo>,
    pub procs: Vec<ProcInfo>,
    pub proc_count: usize,
    pub uptime: u64,
}

pub struct MonitorInner {
    sys: System,
    networks: Networks,
    disks: Disks,
    last_poll: Instant,
    thermal_ok: bool,
}

pub struct MonitorState(pub Mutex<MonitorInner>);

impl Default for MonitorState {
    fn default() -> Self {
        MonitorState(Mutex::new(MonitorInner {
            sys: System::new(),
            networks: Networks::new_with_refreshed_list(),
            disks: Disks::new_with_refreshed_list(),
            last_poll: Instant::now(),
            thermal_ok: true,
        }))
    }
}

fn cpu_temp_wmi() -> Option<f32> {
    let com = wmi::COMLibrary::new().ok()?;
    let conn = wmi::WMIConnection::with_namespace_path("root\\wmi", com).ok()?;
    let rows: Vec<std::collections::HashMap<String, wmi::Variant>> = conn
        .raw_query("SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature")
        .ok()?;
    let mut max_t: Option<f32> = None;
    for row in rows {
        if let Some(v) = row.get("CurrentTemperature") {
            if let Some(raw) = crate::smart::variant_u64(v) {
                let c = raw as f32 / 10.0 - 273.15;
                if c > 0.0 && c < 120.0 {
                    max_t = Some(max_t.map_or(c, |m: f32| m.max(c)));
                }
            }
        }
    }
    max_t
}

fn gpu_info() -> Option<GpuInfo> {
    let nvml = nvml()?;
    let dev = nvml.device_by_index(0).ok()?;
    Some(GpuInfo {
        name: dev.name().unwrap_or_else(|_| "GPU".into()),
        usage: dev.utilization_rates().ok().map(|u| u.gpu),
        vram_used: dev.memory_info().ok().map(|m| m.used),
        vram_total: dev.memory_info().ok().map(|m| m.total),
        temp_c: dev.temperature(TemperatureSensor::Gpu).ok(),
        clock_mhz: dev.clock_info(Clock::Graphics).ok(),
        power_w: dev.power_usage().ok().map(|mw| mw as f32 / 1000.0),
    })
}

pub fn build_snapshot(state: &MonitorState) -> Snapshot {
    let mut inner = state.0.lock().unwrap();
    let elapsed = inner.last_poll.elapsed().as_secs_f64().max(0.2);
    inner.last_poll = Instant::now();

    inner.sys.refresh_cpu_all();
    inner.sys.refresh_memory();
    inner.sys.refresh_processes(ProcessesToUpdate::All, true);
    inner.networks.refresh(true);
    inner.disks.refresh(true);

    let n_cores = inner.sys.cpus().len().max(1);

    let cores: Vec<CoreStat> = inner
        .sys
        .cpus()
        .iter()
        .map(|c| CoreStat {
            usage: c.cpu_usage(),
            freq_mhz: c.frequency(),
        })
        .collect();

    let temp_c = if inner.thermal_ok {
        let t = cpu_temp_wmi();
        if t.is_none() {
            inner.thermal_ok = false;
        }
        t
    } else {
        None
    };

    let cpu = CpuInfo {
        name: inner
            .sys
            .cpus()
            .first()
            .map(|c| c.brand().trim().to_string())
            .unwrap_or_default(),
        usage: inner.sys.global_cpu_usage(),
        freq_mhz: inner.sys.cpus().first().map(|c| c.frequency()).unwrap_or(0),
        cores,
        temp_c,
    };

    let mem = MemInfo {
        total: inner.sys.total_memory(),
        used: inner.sys.used_memory(),
        swap_total: inner.sys.total_swap(),
        swap_used: inner.sys.used_swap(),
    };

    let mut nets: Vec<NetInfo> = inner
        .networks
        .iter()
        .map(|(name, data)| NetInfo {
            name: name.clone(),
            rx_rate: (data.received() as f64 / elapsed) as u64,
            tx_rate: (data.transmitted() as f64 / elapsed) as u64,
            rx_total: data.total_received(),
            tx_total: data.total_transmitted(),
        })
        .collect();
    // Busiest interfaces first, loopback last.
    nets.sort_by(|a, b| (b.rx_total + b.tx_total).cmp(&(a.rx_total + a.tx_total)));

    let disks: Vec<DiskInfo> = inner
        .disks
        .iter()
        .map(|d| {
            let u = d.usage();
            DiskInfo {
                name: d.name().to_string_lossy().to_string(),
                mount: d.mount_point().to_string_lossy().to_string(),
                fs: d.file_system().to_string_lossy().to_string(),
                total: d.total_space(),
                available: d.available_space(),
                read_rate: (u.read_bytes as f64 / elapsed) as u64,
                write_rate: (u.written_bytes as f64 / elapsed) as u64,
            }
        })
        .collect();

    let mut procs: Vec<ProcInfo> = inner
        .sys
        .processes()
        .values()
        .map(|p| ProcInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu: p.cpu_usage() / n_cores as f32,
            mem: p.memory(),
        })
        .collect();
    procs.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    let proc_count = procs.len();
    procs.truncate(20);

    Snapshot {
        cpu,
        mem,
        gpu: gpu_info(),
        nets,
        disks,
        procs,
        proc_count,
        uptime: System::uptime(),
    }
}

#[tauri::command]
pub async fn get_snapshot(
    state: tauri::State<'_, std::sync::Arc<MonitorState>>,
) -> Result<Snapshot, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || build_snapshot(&state))
        .await
        .map_err(|e| e.to_string())
}
