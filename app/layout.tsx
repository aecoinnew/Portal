import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { I18nProvider } from "@/contexts/i18n-context";
import { StagingBanner } from "@/components/ui/staging-banner";
import { APP_TITLE, BRAND } from "@/lib/branding/config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_TITLE,
  description: BRAND.tagline
};

// Runs before paint to set theme + locale/dir attributes and avoid a flash.
const initScript = `(function(){try{var t=localStorage.getItem('emcoin-theme');if(t!=='light'&&t!=='dark'){t='light';}document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('emcoin-locale');if(l!=='en'&&l!=='ar'){l='en';}document.documentElement.setAttribute('lang',l);document.documentElement.setAttribute('dir',l==='ar'?'rtl':'ltr');}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.setAttribute('lang','en');document.documentElement.setAttribute('dir','ltr');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body>
        <I18nProvider>
          <ThemeProvider>
            <StagingBanner />
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
