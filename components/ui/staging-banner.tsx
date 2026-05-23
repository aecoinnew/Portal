"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Banner shown for non-production environments.
 * Reads NEXT_PUBLIC_DEPLOYMENT_ENV at build time.
 */
export function StagingBanner() {
  const env = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
  if (!env || env === "production") return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white">
      <AlertTriangle className="h-3 w-3" />
      <span>{env} environment - not for production data or external clients</span>
    </div>
  );
}
