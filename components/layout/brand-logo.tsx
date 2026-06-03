"use client";

import { BRAND } from "@/lib/branding/config";

type Variant = "auto" | "light" | "dark";

/**
 * Text-based wordmark for EISAX. Resolution-independent, theme-aware, and
 * crisp on every screen (no raster image). The "X" is accented in gold.
 *
 * variant:
 *  - "light": for dark backgrounds (e.g. navy admin sidebar) -> white text
 *  - "dark":  for light backgrounds -> navy text
 *  - "auto":  inherits the current foreground via CSS variables
 */
export function BrandLogo({
  variant = "auto",
  className = "",
  size = 22
}: {
  variant?: Variant;
  className?: string;
  size?: number;
}) {
  const word = (BRAND.shortName || "EISAX").toUpperCase();
  // Split trailing X (or last char) for the accent.
  const hasX = word.endsWith("X");
  const head = hasX ? word.slice(0, -1) : word;
  const tail = hasX ? "X" : "";

  const mainColor =
    variant === "light" ? "#ffffff" : variant === "dark" ? "var(--navy-700, #0B3D91)" : "var(--fg-1)";
  const accent = "var(--sand-400, #B0944D)";

  return (
    <span
      className={`inline-flex select-none items-baseline font-display font-bold tracking-tight ${className}`}
      style={{ fontSize: size, lineHeight: 1, color: mainColor }}
      aria-label={BRAND.name}
    >
      <span>{head}</span>
      {tail ? (
        <span style={{ color: accent }}>{tail}</span>
      ) : null}
    </span>
  );
}
