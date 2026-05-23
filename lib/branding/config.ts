/**
 * White-label branding tokens.
 *
 * These read from NEXT_PUBLIC_* env vars at BUILD TIME (because Next.js
 * inlines them into the client bundle). To change branding after a build,
 * rebuild the app with the new values.
 *
 * Defaults are the original Emcoin brand for backward compatibility.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Emcoin Investment",
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME ?? "Emcoin",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Your investment portal.",
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? "/assets/logo-full.png",
  logoDarkUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_DARK_URL ?? process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? "/assets/logo-full.png",
  primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR ?? "#0B3D91",
  accentColor: process.env.NEXT_PUBLIC_BRAND_ACCENT_COLOR ?? "#B0944D",
  legalFooter:
    process.env.NEXT_PUBLIC_BRAND_LEGAL_FOOTER ??
    "Emcoin Investment is a licensed investment company. Past performance is not indicative of future results."
};

export const APP_TITLE = `${BRAND.name} Portal`;
