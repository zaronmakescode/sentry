import { invoke } from "@tauri-apps/api/core";
import type {
  BatteryInfo,
  DriveHealth,
  PowerPlan,
  Snapshot,
  StartupApp,
  WifiInfo,
} from "./types";

export const getSnapshot = () => invoke<Snapshot>("get_snapshot");
export const getDriveHealth = () => invoke<DriveHealth[]>("get_drive_health");
export const killProcess = (pid: number) => invoke<boolean>("kill_process", { pid });
export const restartExplorer = () => invoke<void>("restart_explorer");
export const purgeStandbyList = () => invoke<number>("purge_standby_list");
export const getPowerPlans = () => invoke<PowerPlan[]>("get_power_plans");
export const setPowerPlan = (guid: string) => invoke<void>("set_power_plan", { guid });
export const getStartupApps = () => invoke<StartupApp[]>("get_startup_apps");
export const toggleStartupApp = (name: string, scope: string, enable: boolean) =>
  invoke<void>("toggle_startup_app", { name, scope, enable });
export const getWifi = () => invoke<WifiInfo | null>("get_wifi");
export const pingHost = (host: string) => invoke<number | null>("ping_host", { host });
export const getBattery = () => invoke<BatteryInfo | null>("get_battery");

export const fmtBytes = (n: number, digits = 1): string => {
  if (!n || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
};

export const fmtRate = (n: number): string => `${fmtBytes(n)}/s`;

export const fmtUptime = (secs: number): string => {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
};
