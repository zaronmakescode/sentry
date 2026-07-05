export interface CoreStat {
  usage: number;
  freq_mhz: number;
}

export interface CpuInfo {
  name: string;
  usage: number;
  freq_mhz: number;
  cores: CoreStat[];
  temp_c: number | null;
}

export interface MemInfo {
  total: number;
  used: number;
  swap_total: number;
  swap_used: number;
}

export interface GpuInfo {
  name: string;
  usage: number | null;
  vram_used: number | null;
  vram_total: number | null;
  temp_c: number | null;
  clock_mhz: number | null;
  power_w: number | null;
}

export interface NetInfo {
  name: string;
  rx_rate: number;
  tx_rate: number;
  rx_total: number;
  tx_total: number;
}

export interface DiskInfo {
  name: string;
  mount: string;
  fs: string;
  total: number;
  available: number;
  read_rate: number;
  write_rate: number;
}

export interface ProcInfo {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
}

export interface Snapshot {
  cpu: CpuInfo;
  mem: MemInfo;
  gpu: GpuInfo | null;
  nets: NetInfo[];
  disks: DiskInfo[];
  procs: ProcInfo[];
  proc_count: number;
  uptime: number;
}

export interface SmartAttr {
  id: number;
  name: string;
  current: number;
  worst: number;
  raw: number;
}

export interface DriveHealth {
  device_id: string;
  model: string;
  serial: string;
  size: number;
  media_type: string;
  bus_type: string;
  health_pct: number;
  health_status: string;
  predict_fail: boolean;
  temp_c: number | null;
  wear_pct: number | null;
  power_on_hours: number | null;
  read_errors: number | null;
  write_errors: number | null;
  attrs: SmartAttr[];
}

export interface PowerPlan {
  guid: string;
  name: string;
  active: boolean;
}

export interface StartupApp {
  name: string;
  command: string;
  scope: "user" | "machine";
  enabled: boolean;
}

export interface WifiInfo {
  ssid: string;
  signal_pct: number;
  radio: string;
  rx_mbps: number | null;
  tx_mbps: number | null;
}

export interface BatteryInfo {
  charge_pct: number;
  status: string;
}
