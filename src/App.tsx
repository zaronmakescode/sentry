import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fmtUptime, getDriveHealth, getSnapshot } from "./api";
import type { DriveHealth, Snapshot } from "./types";
import { Nav, type PageId } from "./components/Nav";
import { TitleBar } from "./components/TitleBar";
import { ActionsPage, DrivesPage, OverviewPage } from "./pages";

const HISTORY = 60;

function push(arr: number[], v: number): number[] {
  const next = [...arr, v];
  return next.length > HISTORY ? next.slice(next.length - HISTORY) : next;
}

export default function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [drives, setDrives] = useState<DriveHealth[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cpuHist, setCpuHist] = useState<number[]>([]);
  const [gpuHist, setGpuHist] = useState<number[]>([]);
  const [rxHist, setRxHist] = useState<number[]>([]);
  const [txHist, setTxHist] = useState<number[]>([]);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const s = await getSnapshot();
        if (!live) return;
        setSnap(s);
        setCpuHist((h) => push(h, s.cpu.usage));
        setGpuHist((h) => push(h, s.gpu?.usage ?? 0));
        setRxHist((h) => push(h, s.nets[0]?.rx_rate ?? 0));
        setTxHist((h) => push(h, s.nets[0]?.tx_rate ?? 0));
      } catch {
        /* backend warming up */
      }
    };
    poll();
    const id = setInterval(poll, 1500);

    const pollDrives = async () => {
      try {
        const d = await getDriveHealth();
        if (live) setDrives(d);
      } catch {
        if (live) setDrives([]);
      }
    };
    pollDrives();
    const driveId = setInterval(pollDrives, 60_000);

    return () => {
      live = false;
      clearInterval(id);
      clearInterval(driveId);
    };
  }, []);

  const hist = { cpu: cpuHist, gpu: gpuHist, rx: rxHist, tx: txHist };

  const renderPage = () => {
    if (!snap) return null;
    switch (page) {
      case "overview":
        return <OverviewPage snap={snap} hist={hist} drives={drives} notify={notify} />;
      case "drives":
        return <DrivesPage snap={snap} drives={drives} />;
      case "actions":
        return <ActionsPage notify={notify} />;
    }
  };

  return (
    <div className="app-shell">
      <TitleBar uptime={snap ? fmtUptime(snap.uptime) : "…"} />
      <div className="flex min-h-0 flex-1">
        <Nav active={page} onChange={setPage} />
        <main className="scroll-thin flex-1 p-4">
          {snap ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex h-full items-center justify-center">
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="label"
              >
                initializing sensors
              </motion.div>
            </div>
          )}
        </main>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="glass num fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4 py-2 text-[12px] text-white/85"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
