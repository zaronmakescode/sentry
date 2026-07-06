import { useEffect, useState } from "react";
import { fmtBytes, fmtRate, getBattery } from "./api";
import type { BatteryInfo, DriveHealth, Snapshot } from "./types";
import { Bar, Card, CoreHeatmap, Gauge, Sparkline } from "./components/primitives";
import { DisksCard } from "./components/PerfCards";
import { HealthCard } from "./components/HealthCard";
import { ProcessesCard } from "./components/ProcessesCard";
import { CommandCard } from "./components/CommandCard";

interface Hist {
  cpu: number[];
  gpu: number[];
  rx: number[];
  tx: number[];
}

function TempRow({ name, temp, max = 90 }: { name: string; temp: number; max?: number }) {
  const col = temp > max * 0.85 ? "#f2757f" : temp > max * 0.66 ? "#e5b567" : "#7dd3a8";
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-[11px] text-white/60">{name}</span>
      <div className="min-w-0 flex-1">
        <Bar pct={(temp / max) * 100} color={col} />
      </div>
      <span className="num w-12 shrink-0 text-right text-[11px]" style={{ color: col }}>
        {temp}°C
      </span>
    </div>
  );
}

function BatteryBlock({ bat }: { bat: BatteryInfo }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="label">battery</span>
        <span className="num text-[11px] text-white/50">
          {bat.charge_pct}% · {bat.status}
        </span>
      </div>
      <Bar pct={bat.charge_pct} color={bat.charge_pct < 20 ? "#f2757f" : "#7dd3a8"} />
      {bat.health_pct != null && (
        <>
          <div className="mb-1 mt-3 flex items-baseline justify-between">
            <span className="label">battery health</span>
            <span className="num text-[11px] text-white/50">
              {bat.health_pct}% of design
            </span>
          </div>
          <Bar
            pct={bat.health_pct}
            color={bat.health_pct < 60 ? "#f2757f" : bat.health_pct < 80 ? "#e5b567" : "#7dd3a8"}
          />
          {bat.full_capacity_mwh != null && bat.design_capacity_mwh != null && (
            <div className="num mt-1 text-[10px] text-white/30">
              {(bat.full_capacity_mwh / 1000).toFixed(1)} Wh now ·{" "}
              {(bat.design_capacity_mwh / 1000).toFixed(1)} Wh designed
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function OverviewPage({
  snap,
  hist,
  drives,
  notify,
}: {
  snap: Snapshot;
  hist: Hist;
  drives: DriveHealth[] | null;
  notify: (m: string) => void;
}) {
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  useEffect(() => {
    let live = true;
    const poll = () =>
      getBattery()
        .then((b) => live && setBattery(b))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  const memPct = snap.mem.total ? (snap.mem.used / snap.mem.total) * 100 : 0;
  const gpu = snap.gpu;
  const net = snap.nets[0];
  const driveTemps = (drives ?? []).filter((d) => d.temp_c != null);

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* gauges */}
      <Card title="CPU" className="col-span-12 sm:col-span-4" delay={0.02}
        right={<span className="num truncate text-[10px] text-white/25">{snap.cpu.name}</span>}>
        <Gauge
          pct={snap.cpu.usage}
          value={snap.cpu.usage.toFixed(0)}
          unit="%"
          label="load"
          sub={`${(snap.cpu.freq_mhz / 1000).toFixed(2)} GHz · ${snap.cpu.cores.length} threads`}
        />
      </Card>
      <Card title="Memory" className="col-span-12 sm:col-span-4" delay={0.05}>
        <Gauge
          pct={memPct}
          color="#e7e9ec"
          value={memPct.toFixed(0)}
          unit="%"
          label="in use"
          sub={`${fmtBytes(snap.mem.used)} / ${fmtBytes(snap.mem.total)}`}
        />
      </Card>
      <Card title="GPU" className="col-span-12 sm:col-span-4" delay={0.08}
        right={gpu && <span className="num truncate text-[10px] text-white/25">{gpu.name}</span>}>
        {gpu && gpu.usage != null ? (
          <Gauge
            pct={gpu.usage}
            color="#7dd3a8"
            value={String(gpu.usage)}
            unit="%"
            label="load"
            sub={[
              gpu.temp_c != null ? `${gpu.temp_c}°C` : null,
              gpu.power_w != null ? `${gpu.power_w.toFixed(0)} W` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ) : (
          <div className="flex h-full min-h-32 items-center justify-center text-[12px] text-white/25">
            no GPU telemetry
          </div>
        )}
      </Card>

      {/* history + right rail */}
      <Card title="CPU History" className="col-span-12 lg:col-span-8" delay={0.11}
        right={<span className="label">90 s</span>}>
        <Sparkline data={hist.cpu} max={100} height={120} grid dot />
        <div className="mt-3">
          <CoreHeatmap cores={snap.cpu.cores} />
        </div>
      </Card>

      <Card title="Health" className="col-span-12 lg:col-span-4" delay={0.14}>
        <div className="space-y-3">
          {gpu?.temp_c != null && <TempRow name={gpu.name} temp={gpu.temp_c} />}
          {driveTemps.map((d) => (
            <TempRow key={d.device_id} name={d.model} temp={d.temp_c!} max={70} />
          ))}
          {battery ? (
            <div className="border-t border-white/[0.05] pt-3">
              <BatteryBlock bat={battery} />
            </div>
          ) : (
            <div className="border-t border-white/[0.05] pt-3 text-[11px] text-white/30">
              no battery — desktop / AC
            </div>
          )}
        </div>
      </Card>

      {/* network + processes */}
      <Card title="Network" className="col-span-12 lg:col-span-4" delay={0.17}
        right={net && <span className="num truncate text-[10px] text-white/25">{net.name}</span>}>
        {net ? (
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <span className="label block">down</span>
                <span className="num text-lg font-light text-accent">{fmtRate(net.rx_rate)}</span>
              </div>
              <div className="text-right">
                <span className="label block">up</span>
                <span className="num text-lg font-light text-up">{fmtRate(net.tx_rate)}</span>
              </div>
            </div>
            <div className="relative h-12">
              <div className="absolute inset-0">
                <Sparkline data={hist.rx} height={48} />
              </div>
              <div className="absolute inset-0">
                <Sparkline data={hist.tx} color="#7dd3a8" height={48} />
              </div>
            </div>
            <div className="num flex justify-between text-[10px] text-white/30">
              <span>Σ↓ {fmtBytes(net.rx_total)}</span>
              <span>Σ↑ {fmtBytes(net.tx_total)}</span>
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-white/30">No interfaces</div>
        )}
      </Card>

      <ProcessesCard
        snap={snap}
        onKilled={notify}
        className="col-span-12 lg:col-span-8"
        maxRows="max-h-64"
      />
    </div>
  );
}

export function DrivesPage({
  snap,
  drives,
}: {
  snap: Snapshot;
  drives: DriveHealth[] | null;
}) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <HealthCard drives={drives} className="col-span-12 lg:col-span-7" />
      <DisksCard snap={snap} className="col-span-12 lg:col-span-5" />
    </div>
  );
}

export function ActionsPage({ notify }: { notify: (m: string) => void }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <CommandCard notify={notify} className="col-span-12" />
    </div>
  );
}
