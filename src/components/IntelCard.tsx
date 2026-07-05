import { useEffect, useState } from "react";
import { getBattery, getWifi, pingHost } from "../api";
import type { BatteryInfo, WifiInfo } from "../types";
import { Card } from "./primitives";

function Fact({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="label">{k}</span>
      <span className={`num text-[12px] ${accent ? "text-accent" : "text-white/75"}`}>{v}</span>
    </div>
  );
}

export function IntelCard({ className = "" }: { className?: string }) {
  const [wifi, setWifi] = useState<WifiInfo | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [publicIp, setPublicIp] = useState<string>("…");

  useEffect(() => {
    let live = true;
    const poll = async () => {
      const [w, b, p] = await Promise.allSettled([
        getWifi(),
        getBattery(),
        pingHost("1.1.1.1"),
      ]);
      if (!live) return;
      if (w.status === "fulfilled") setWifi(w.value);
      if (b.status === "fulfilled") setBattery(b.value);
      if (p.status === "fulfilled") setPing(p.value);
    };
    poll();
    const id = setInterval(poll, 5000);
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((j) => live && setPublicIp(j.ip))
      .catch(() => live && setPublicIp("offline"));
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Card title="Intel" className={className} delay={0.2}>
      <div>
        <Fact k="public ip" v={publicIp} />
        <Fact
          k="latency 1.1.1.1"
          v={ping != null ? `${ping} ms` : "–"}
          accent={ping != null && ping < 40}
        />
        {wifi && (
          <>
            <Fact k="wi-fi" v={`${wifi.ssid} · ${wifi.signal_pct}%`} />
            <Fact
              k="link"
              v={`${wifi.radio}${wifi.rx_mbps ? ` · ${wifi.rx_mbps.toFixed(0)} Mbps` : ""}`}
            />
          </>
        )}
        {battery ? (
          <Fact k="battery" v={`${battery.charge_pct}% · ${battery.status}`} />
        ) : (
          <Fact k="power" v="AC / desktop" />
        )}
      </div>
    </Card>
  );
}
