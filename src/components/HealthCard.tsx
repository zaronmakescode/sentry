import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fmtBytes } from "../api";
import type { DriveHealth } from "../types";
import { Card, Ring } from "./primitives";

function DriveRow({ drive }: { drive: DriveHealth }) {
  const [open, setOpen] = useState(false);
  const col =
    drive.health_pct > 66 ? "#a3e635" : drive.health_pct > 33 ? "#fbbf24" : "#fb7185";
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-4 text-left"
      >
        <Ring pct={drive.health_pct} size={64} stroke={5} color={col}>
          <span className="num text-sm font-semibold text-white">{drive.health_pct}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white/85">{drive.model}</div>
          <div className="num mt-0.5 text-[10px] text-white/40">
            {drive.bus_type} {drive.media_type} · {fmtBytes(drive.size)}
            {drive.serial && ` · SN ${drive.serial}`}
          </div>
          <div className="num mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
            <span style={{ color: col }}>{drive.health_status}</span>
            {drive.temp_c != null && <span className="text-white/50">{drive.temp_c}°C</span>}
            {drive.power_on_hours != null && (
              <span className="text-white/50">{drive.power_on_hours.toLocaleString()} h powered</span>
            )}
            {drive.wear_pct != null && <span className="text-white/50">{drive.wear_pct}% worn</span>}
            {drive.predict_fail && <span className="text-danger">FAILURE PREDICTED</span>}
          </div>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          className={`shrink-0 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 3.5 L5 7.5 L9 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {drive.attrs.length > 0 ? (
              <table className="num mt-3 w-full text-[10px] text-white/55">
                <thead>
                  <tr className="label text-left">
                    <th className="pb-1 font-semibold">id</th>
                    <th className="pb-1 font-semibold">attribute</th>
                    <th className="pb-1 text-right font-semibold">cur</th>
                    <th className="pb-1 text-right font-semibold">worst</th>
                    <th className="pb-1 text-right font-semibold">raw</th>
                  </tr>
                </thead>
                <tbody>
                  {drive.attrs.map((a) => (
                    <tr key={a.id} className="border-t border-white/[0.04]">
                      <td className="py-0.5">{a.id}</td>
                      <td className="py-0.5">{a.name}</td>
                      <td className="py-0.5 text-right">{a.current}</td>
                      <td className="py-0.5 text-right">{a.worst}</td>
                      <td className="py-0.5 text-right">{a.raw.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="num mt-3 grid grid-cols-2 gap-1 text-[10px] text-white/50">
                {drive.read_errors != null && <span>read errors: {drive.read_errors}</span>}
                {drive.write_errors != null && <span>write errors: {drive.write_errors}</span>}
                <span className="col-span-2 text-white/30">
                  NVMe health via Windows storage reliability counters
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HealthCard({
  drives,
  className = "",
}: {
  drives: DriveHealth[] | null;
  className?: string;
}) {
  return (
    <Card title="Drive Health" className={className} delay={0.22}
      right={<span className="label">s.m.a.r.t.</span>}>
      <div className="scroll-thin max-h-full space-y-2 pr-1">
        {drives === null ? (
          <div className="text-[12px] text-white/30">Reading drive telemetry…</div>
        ) : drives.length === 0 ? (
          <div className="text-[12px] text-white/30">No drives detected</div>
        ) : (
          drives.map((d) => <DriveRow key={d.device_id} drive={d} />)
        )}
      </div>
    </Card>
  );
}
