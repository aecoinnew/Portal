import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600 shadow-card">{label}</div>;
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
      <div className="text-[13px] font-medium text-slate-700">{title}</div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
