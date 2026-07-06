import { fmtBytes, fmtRate } from "../api";
import type { Snapshot } from "../types";
import { Bar, Card, Sparkline } from "./primitives";

export function CpuCard({
  snap,
  history,
  className = "",
}: {
  snap: Snapshot;
  history: number[];
  className?: string;
}) {
  const { cpu } = snap;
  return (
    <Card
      title="CPU"
      className={className}
      delay={0.02}
      right={<span className="num truncate text-[11px] text-white/30">{cpu.name}</span>}
    >
      <div className="flex items-start gap-4">
        <div>
          <div className="num text-4xl font-semibold text-white">
            {cpu.usage.toFixed(0)}
            <span className="text-lg text-white/35">%</span>
          </div>
          <div className="num mt-1 text-[11px] text-white/40">
            {(cpu.freq_mhz / 1000).toFixed(2)} GHz · {cpu.cores.length} threads
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <Sparkline data={history} max={100} height={56} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-8 gap-1.5">
        {cpu.cores.map((c, i) => (
          <div key={i} title={`Core ${i}: ${c.usage.toFixed(0)}% @ ${c.freq_mhz} MHz`}>
            <Bar pct={c.usage} color={c.usage > 85 ? "#f2757f" : "#22d3ee"} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function GpuCard({
  snap,
  history,
  className = "",
}: {
  snap: Snapshot;
  history: number[];
  className?: string;
}) {
  const gpu = snap.gpu;
  return (
    <Card
      title="GPU"
      className={className}
      delay={0.06}
      right={gpu && <span className="num truncate text-[11px] text-white/30">{gpu.name}</span>}
    >
      {gpu ? (
        <>
          <div className="flex items-start gap-4">
            <div>
              <div className="num text-4xl font-semibold text-white">
                {gpu.usage ?? "–"}
                <span className="text-lg text-white/35">%</span>
              </div>
              <div className="num mt-1 text-[11px] text-white/40">
                {gpu.temp_c != null && `${gpu.temp_c}°C`}
                {gpu.clock_mhz != null && ` · ${gpu.clock_mhz} MHz`}
                {gpu.power_w != null && ` · ${gpu.power_w.toFixed(0)} W`}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Sparkline data={history} max={100} color="#7dd3a8" height={56} />
            </div>
          </div>
          {gpu.vram_used != null && gpu.vram_total != null && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between">
                <span className="label">vram</span>
                <span className="num text-[11px] text-white/45">
                  {fmtBytes(gpu.vram_used)} / {fmtBytes(gpu.vram_total)}
                </span>
              </div>
              <Bar pct={(gpu.vram_used / gpu.vram_total) * 100} color="#7dd3a8" />
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full min-h-24 items-center justify-center text-center text-[12px] text-white/30">
          No NVIDIA GPU telemetry
        </div>
      )}
    </Card>
  );
}

export function NetworkCard({
  snap,
  rxHist,
  txHist,
  className = "",
}: {
  snap: Snapshot;
  rxHist: number[];
  txHist: number[];
  className?: string;
}) {
  const main = snap.nets[0];
  return (
    <Card
      title="Network"
      className={className}
      delay={0.1}
      right={main && <span className="num truncate text-[11px] text-white/30">{main.name}</span>}
    >
      {main ? (
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <div>
              <span className="label block">down</span>
              <span className="num text-xl font-semibold text-accent">{fmtRate(main.rx_rate)}</span>
            </div>
            <div className="text-right">
              <span className="label block">up</span>
              <span className="num text-xl font-semibold text-up">{fmtRate(main.tx_rate)}</span>
            </div>
          </div>
          <div className="relative h-12">
            <div className="absolute inset-0">
              <Sparkline data={rxHist} height={48} />
            </div>
            <div className="absolute inset-0">
              <Sparkline data={txHist} color="#7dd3a8" height={48} />
            </div>
          </div>
          <div className="num flex justify-between text-[10px] text-white/30">
            <span>Σ↓ {fmtBytes(main.rx_total)}</span>
            <span>Σ↑ {fmtBytes(main.tx_total)}</span>
          </div>
        </div>
      ) : (
        <div className="text-[12px] text-white/30">No interfaces</div>
      )}
    </Card>
  );
}

export function DisksCard({ snap, className = "" }: { snap: Snapshot; className?: string }) {
  return (
    <Card title="Volumes" className={className} delay={0.14}>
      <div className="scroll-thin max-h-full space-y-3 pr-1">
        {snap.disks.map((d) => {
          const usedPct = d.total ? ((d.total - d.available) / d.total) * 100 : 0;
          return (
            <div key={d.mount}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[12px] font-medium text-white/75">
                  {d.mount} <span className="text-white/30">{d.fs}</span>
                </span>
                <span className="num text-[10px] text-white/40">
                  R {fmtRate(d.read_rate)} · W {fmtRate(d.write_rate)}
                </span>
              </div>
              <Bar pct={usedPct} color={usedPct > 90 ? "#f2757f" : "#22d3ee"} />
              <div className="num mt-0.5 text-[10px] text-white/35">
                {fmtBytes(d.total - d.available)} of {fmtBytes(d.total)} · {usedPct.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
