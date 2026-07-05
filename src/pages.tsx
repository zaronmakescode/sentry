import { useState } from "react";
import { fmtBytes, fmtUptime, purgeStandbyList } from "./api";
import type { DriveHealth, Snapshot } from "./types";
import { Bar, Card, Ring } from "./components/primitives";
import { CpuCard, DisksCard, GpuCard, NetworkCard } from "./components/PerfCards";
import { HealthCard } from "./components/HealthCard";
import { ProcessesCard } from "./components/ProcessesCard";
import { CommandCard } from "./components/CommandCard";
import { IntelCard } from "./components/IntelCard";

interface Hist {
  cpu: number[];
  gpu: number[];
  rx: number[];
  tx: number[];
}

function StatTile({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
      <div className="label">{k}</div>
      <div className="num mt-1 text-lg font-semibold text-white/90">{v}</div>
      {sub && <div className="num text-[10px] text-white/35">{sub}</div>}
    </div>
  );
}

export function StatsPage({ snap, hist }: { snap: Snapshot; hist: Hist }) {
  const memPct = snap.mem.total ? (snap.mem.used / snap.mem.total) * 100 : 0;
  return (
    <div className="grid grid-cols-12 gap-3">
      <CpuCard snap={snap} history={hist.cpu} className="col-span-12 lg:col-span-7" />
      <GpuCard snap={snap} history={hist.gpu} className="col-span-12 sm:col-span-6 lg:col-span-5" />
      <NetworkCard snap={snap} rxHist={hist.rx} txHist={hist.tx} className="col-span-12 sm:col-span-6 lg:col-span-5" />
      <Card title="System" className="col-span-12 lg:col-span-7" delay={0.14}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile k="uptime" v={fmtUptime(snap.uptime)} />
          <StatTile k="processes" v={String(snap.proc_count)} />
          <StatTile k="cpu load" v={`${snap.cpu.usage.toFixed(0)}%`} sub={`${snap.cpu.cores.length} threads`} />
          <StatTile k="memory" v={`${memPct.toFixed(0)}%`} sub={`${fmtBytes(snap.mem.used)} used`} />
        </div>
      </Card>
    </div>
  );
}

export function MemoryPage({
  snap,
  notify,
}: {
  snap: Snapshot;
  notify: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { mem } = snap;
  const pct = mem.total ? (mem.used / mem.total) * 100 : 0;
  const swapPct = mem.swap_total ? (mem.swap_used / mem.swap_total) * 100 : 0;
  const avail = mem.total - mem.used;

  const byMem = [...snap.procs].sort((a, b) => b.mem - a.mem).slice(0, 12);
  const maxMem = byMem[0]?.mem || 1;

  const purge = async () => {
    setBusy(true);
    try {
      const freed = await purgeStandbyList();
      notify(`Standby list purged — ${freed} MB reclaimed`);
    } catch (e) {
      notify(`Purge failed: ${e}`);
    }
    setBusy(false);
  };

  return (
    <div className="grid grid-cols-12 gap-3">
      <Card title="Physical Memory" className="col-span-12 lg:col-span-5" delay={0.02}>
        <div className="flex items-center gap-5">
          <Ring pct={pct} size={112} stroke={7}
            color={pct > 90 ? "#f2757f" : pct > 75 ? "#e5b567" : "#22d3ee"}>
            <span className="num text-2xl font-semibold text-white">{pct.toFixed(0)}%</span>
            <span className="label">in use</span>
          </Ring>
          <div className="flex-1 space-y-2.5">
            <div>
              <span className="label block">used</span>
              <span className="num text-white/85">{fmtBytes(mem.used)}</span>
            </div>
            <div>
              <span className="label block">available</span>
              <span className="num text-white/85">{fmtBytes(avail)}</span>
            </div>
            <div>
              <span className="label block">total</span>
              <span className="num text-white/85">{fmtBytes(mem.total)}</span>
            </div>
          </div>
        </div>
        {mem.swap_total > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between">
              <span className="label">pagefile</span>
              <span className="num text-[11px] text-white/45">
                {fmtBytes(mem.swap_used)} / {fmtBytes(mem.swap_total)}
              </span>
            </div>
            <Bar pct={swapPct} color="#818cf8" />
          </div>
        )}
        <button
          onClick={purge}
          disabled={busy}
          className="mt-4 w-full rounded-lg border border-accent/25 bg-accent/[0.07] py-2 text-[12px] font-medium text-accent transition hover:bg-accent/15 disabled:opacity-40"
        >
          {busy ? "purging…" : "Purge standby memory list"}
        </button>
      </Card>

      <Card title="Top Memory" className="col-span-12 lg:col-span-7" delay={0.06}
        right={<span className="label">by working set</span>}>
        <div className="space-y-1.5">
          {byMem.map((p) => (
            <div key={p.pid} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-[12px] text-white/75">{p.name}</span>
              <div className="min-w-0 flex-1">
                <Bar pct={(p.mem / maxMem) * 100} />
              </div>
              <span className="num w-20 shrink-0 text-right text-[11px] text-white/55">
                {fmtBytes(p.mem)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function StoragePage({ snap, drives }: { snap: Snapshot; drives: DriveHealth[] | null }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <HealthCard drives={drives} className="col-span-12 lg:col-span-7" />
      <DisksCard snap={snap} className="col-span-12 lg:col-span-5" />
    </div>
  );
}

export function ProcessesPage({
  snap,
  notify,
}: {
  snap: Snapshot;
  notify: (m: string) => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <ProcessesCard snap={snap} onKilled={notify} className="col-span-12" maxRows="max-h-[calc(100vh-190px)]" />
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

export function IntelPage({
  snap,
  hist,
}: {
  snap: Snapshot;
  hist: Hist;
}) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <IntelCard className="col-span-12 lg:col-span-5" />
      <NetworkCard snap={snap} rxHist={hist.rx} txHist={hist.tx} className="col-span-12 lg:col-span-7" />
    </div>
  );
}
