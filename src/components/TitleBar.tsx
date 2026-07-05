import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar({ uptime }: { uptime: string }) {
  const win = getCurrentWindow();
  return (
    <div
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.05] px-4"
    >
      <div data-tauri-drag-region className="flex items-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <span
          data-tauri-drag-region
          className="text-[13px] font-semibold tracking-[0.35em] text-white/80"
        >
          SENTRY
        </span>
        <span data-tauri-drag-region className="label mt-px">
          system intelligence
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="num mr-3 text-[11px] text-white/35">up {uptime}</span>
        <button
          onClick={() => win.minimize()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
          title="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          onClick={() => win.toggleMaximize()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
          title="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" rx="1" />
          </svg>
        </button>
        <button
          onClick={() => win.hide()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition hover:bg-danger/20 hover:text-danger"
          title="Hide to tray"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
