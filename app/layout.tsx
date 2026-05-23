import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { StagingBanner } from "@/components/ui/staging-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emcoin Investment Portal",
  description: "Secure local investment client portal and admin backoffice"
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
