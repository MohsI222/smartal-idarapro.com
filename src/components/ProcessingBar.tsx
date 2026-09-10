/**
 * Sleek full-width progress indicator for AI and export actions.
 */

type Props = {
  active: boolean;
  /** Shown next to the bar */
  label: string;
  /** 0–1 when known; omit for indeterminate shimmer */
  progress?: number;
};

export function ProcessingBar({ active, label, progress }: Props) {
  if (!active) return null;
  const pct =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, Math.round(progress * 100)))
      : null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[200] pointer-events-none px-4 pb-4 flex justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-cyan-500/25 bg-[#0a1628]/95 backdrop-blur-xl shadow-[0_-8px_40px_rgba(0,0,0,0.45)] px-4 py-3 pointer-events-auto">
        <p className="text-xs font-semibold text-cyan-100/95 mb-2 text-center tracking-wide">{label}</p>
        <div
          className="h-2 rounded-full bg-white/10 overflow-hidden border border-white/10"
          role="progressbar"
          aria-valuenow={pct ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {pct != null ? (
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out bg-gradient-to-r from-cyan-400 via-[#0052CC] to-fuchsia-500 shadow-[0_0_14px_rgba(0,200,255,0.45)]"
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          ) : (
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-400/90 via-[#0052CC] to-fuchsia-500/90 animate-pulse motion-reduce:animate-none" />
          )}
        </div>
      </div>
    </div>
  );
}
