import { useEffect, useState } from "react";
import {
  getPowerPlans,
  getStartupApps,
  purgeStandbyList,
  restartExplorer,
  setPowerPlan,
  toggleStartupApp,
} from "../api";
import type { PowerPlan, StartupApp } from "../types";
import { Card } from "./primitives";

function ActionButton({
  label,
  onClick,
  busy,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
    >
      {busy ? "…" : label}
    </button>
  );
}

export function CommandCard({
  notify,
  className = "",
}: {
  notify: (msg: string) => void;
  className?: string;
}) {
  const [plans, setPlans] = useState<PowerPlan[]>([]);
  const [startup, setStartup] = useState<StartupApp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [p, s] = await Promise.all([getPowerPlans(), getStartupApps()]);
      setPlans(p);
      setStartup(s);
    } catch (e) {
      notify(`Load failed: ${e}`);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    try {
      notify(await fn());
    } catch (e) {
      notify(`Failed: ${e}`);
    }
    setBusy(null);
  };

  return (
    <Card title="Command" className={className} delay={0.3}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div>
          <div className="label mb-2">power plan</div>
          <div className="flex flex-wrap gap-1.5">
            {plans.map((p) => (
              <button
                key={p.guid}
                onClick={() =>
                  run("plan", async () => {
                    await setPowerPlan(p.guid);
                    await refresh();
                    return `Power plan → ${p.name}`;
                  })
                }
                className={`rounded-full px-3 py-1 text-[11px] transition ${
                  p.active
                    ? "border border-accent/50 bg-accent/15 text-accent"
                    : "border border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white/80"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="label mb-2 mt-4">actions</div>
          <div className="flex flex-wrap gap-1.5">
            <ActionButton
              label="Purge standby RAM"
              busy={busy === "purge"}
              onClick={() =>
                run("purge", async () => {
                  const freed = await purgeStandbyList();
                  return `Standby list purged — ${freed} MB freed`;
                })
              }
            />
            <ActionButton
              label="Restart Explorer"
              busy={busy === "explorer"}
              onClick={() =>
                run("explorer", async () => {
                  await restartExplorer();
                  return "Explorer restarted";
                })
              }
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="label mb-2">startup apps · {startup.filter((s) => s.enabled).length} enabled</div>
          <div className="scroll-thin max-h-40 space-y-1 pr-1">
            {startup.map((s) => (
              <div
                key={`${s.scope}-${s.name}`}
                className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-1.5"
              >
                <button
                  onClick={() =>
                    run(`st-${s.name}`, async () => {
                      await toggleStartupApp(s.name, s.scope, !s.enabled);
                      await refresh();
                      return `${s.name} ${s.enabled ? "disabled" : "enabled"} at startup`;
                    })
                  }
                  className={`relative h-4 w-7 shrink-0 rounded-full transition ${
                    s.enabled ? "bg-accent/70" : "bg-white/[0.1]"
                  }`}
                  title={s.enabled ? "Disable" : "Enable"}
                >
                  <span
                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                      s.enabled ? "left-3.5" : "left-0.5"
                    }`}
                  />
                </button>
                <span className="min-w-0 flex-1 truncate text-[11px] text-white/70" title={s.command}>
                  {s.name}
                </span>
                <span className="label shrink-0">{s.scope}</span>
              </div>
            ))}
            {startup.length === 0 && (
              <div className="text-[11px] text-white/30">No registry startup entries</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
