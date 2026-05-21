import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function MetricCard({
  label,
  value,
  sub,
  tone,
  children,
  compact = false
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "gain" | "loss" | "warning";
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-card sm:px-5">
      <div className="mb-2 truncate text-[10px] font-semibold uppercase text-slate-500" style={{ letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-display font-semibold leading-tight tabular-nums text-slate-900",
          compact ? "text-[20px]" : "text-[clamp(18px,1.65vw,26px)]",
          tone === "gain" && "gain",
          tone === "loss" && "loss",
          tone === "warning" && "text-amber-700"
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 truncate text-[11px] tabular-nums text-slate-500">{sub}</div> : null}
      {children}
    </div>
  );
}
