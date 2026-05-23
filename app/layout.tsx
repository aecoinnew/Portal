import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { StagingBanner } from "@/components/ui/staging-banner";
import { APP_TITLE, BRAND } from "@/lib/branding/config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_TITLE,
  description: BRAND.tagline
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StagingBanner />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
