import { useState } from "react";
import { fmtBytes, killProcess } from "../api";
import type { Snapshot } from "../types";
import { Card } from "./primitives";

export function ProcessesCard({
  snap,
  onKilled,
  className = "",
  maxRows = "max-h-72",
}: {
  snap: Snapshot;
  onKilled: (msg: string) => void;
  className?: string;
  maxRows?: string;
}) {
  const [confirmPid, setConfirmPid] = useState<number | null>(null);

  const kill = async (pid: number, name: string) => {
    try {
      await killProcess(pid);
      onKilled(`Terminated ${name} (${pid})`);
    } catch (e) {
      onKilled(`Failed: ${e}`);
    }
    setConfirmPid(null);
  };

  return (
    <Card
      title="Processes"
      className={className}
      delay={0.26}
      right={<span className="num text-[11px] text-white/35">{snap.proc_count} running</span>}
    >
      <div className={`scroll-thin ${maxRows} pr-1`}>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="label sticky top-0 bg-transparent text-left">
              <th className="pb-2 font-semibold">process</th>
              <th className="pb-2 text-right font-semibold">pid</th>
              <th className="pb-2 text-right font-semibold">cpu</th>
              <th className="pb-2 text-right font-semibold">memory</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="num">
            {snap.procs.map((p) => (
              <tr key={p.pid} className="group border-t border-white/[0.04] text-white/65">
                <td className="max-w-40 truncate py-1 pr-2 font-sans text-white/80">{p.name}</td>
                <td className="py-1 text-right text-white/35">{p.pid}</td>
                <td className={`py-1 text-right ${p.cpu > 20 ? "text-warn" : ""}`}>
                  {p.cpu.toFixed(1)}%
                </td>
                <td className="py-1 text-right">{fmtBytes(p.mem)}</td>
                <td className="w-14 py-1 text-right">
                  {confirmPid === p.pid ? (
                    <button
                      onClick={() => kill(p.pid, p.name)}
                      onMouseLeave={() => setConfirmPid(null)}
                      className="rounded bg-danger/25 px-1.5 py-0.5 text-[10px] font-semibold text-danger"
                    >
                      sure?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmPid(p.pid)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-white/0 transition group-hover:text-danger/80 hover:bg-danger/15"
                    >
                      kill
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
