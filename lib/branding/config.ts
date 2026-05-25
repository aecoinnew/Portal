/**
 * White-label branding tokens.
 *
 * These read from NEXT_PUBLIC_* env vars at BUILD TIME (because Next.js
 * inlines them into the client bundle). To change branding after a build,
 * rebuild the app with the new values.
 *
 * Defaults are the EisaX Wealth brand.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "EisaX Wealth",
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME ?? "EisaX",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Your investment portal.",
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? "https://res.cloudinary.com/dfh3erwx1/image/upload/v1779708217/ChatGPT_Image_May_25_2026_03_20_26_PM_cvmazb.png",
  logoDarkUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_DARK_URL ?? "https://res.cloudinary.com/dfh3erwx1/image/upload/v1779708217/ChatGPT_Image_May_25_2026_03_22_42_PM_qnzrsf.png",
  primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR ?? "#0B3D91",
  accentColor: process.env.NEXT_PUBLIC_BRAND_ACCENT_COLOR ?? "#B0944D",
  legalFooter:
    process.env.NEXT_PUBLIC_BRAND_LEGAL_FOOTER ??
    "EisaX Wealth is a licensed investment company. Past performance is not indicative of future results."
};

export const APP_TITLE = `${BRAND.name} Portal`;
