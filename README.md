# Sentry

A minimalist, low-footprint Windows system-intelligence dashboard — think *HDD Sentinel × Task Manager*, in a near-black frosted-glass interface. Built with Tauri (Rust) + React, so it stays small and light while pulling deep hardware telemetry.

> Live CPU / GPU / RAM / network, S.M.A.R.T. drive health, and system controls — in one clean window and a system-tray flyout.

## Features

- **Stats** — per-core CPU load & clocks, GPU usage/VRAM/temp/power (NVIDIA), live network throughput, uptime and system summary.
- **Memory** — usage ring, available/total breakdown, pagefile, top processes by working set, and one-click **standby-list purge** to reclaim cached RAM.
- **Storage** — per-drive **S.M.A.R.T.** health with a computed health score, temperature, power-on hours, wear level, and raw attribute tables (SATA + NVMe).
- **Processes** — live process table with per-process CPU/memory and a kill action.
- **Actions** — switch Windows **power plans**, toggle **startup apps**, restart Explorer, purge memory.
- **Intel** — public IP, latency/ping, Wi-Fi signal & link rate, battery health.
- **Tray + dashboard** — closes to the system tray; click the tray icon to reopen.

## Design

Near-black (`#030405`) frosted-glass panels, hairline borders, monochrome type with a single restrained cyan accent. Framer Motion transitions. Low RAM by design (Tauri webview + Rust backend — no Electron).

## Download

Grab the latest **`.msi`** installer from the [**Releases**](../../releases) page and run it. Windows only.

> **Use the `.msi`.** The `-setup.exe` is unsigned and antivirus/SmartScreen frequently blocks it silently; the MSI installs cleanly.
>
> Sentry requests administrator rights on launch — S.M.A.R.T. data and some sensors are inaccessible without elevation.

## Tech

| Layer     | Stack                                                       |
|-----------|-------------------------------------------------------------|
| Shell     | [Tauri 2](https://tauri.app)                                |
| Frontend  | React 19 · TypeScript · Tailwind v4 · Framer Motion         |
| Backend   | Rust — `sysinfo`, `wmi`, `nvml-wrapper`, `winreg`, `windows` |

## Build from source

Requires [Node.js](https://nodejs.org), [Rust](https://rustup.rs) (MSVC toolchain), and the Visual Studio C++ build tools.

```bash
npm install
npm run tauri dev      # run in development
npm run tauri build    # produce the release installer (src-tauri/target/release/bundle)
```

## License

MIT — see [LICENSE](LICENSE).
