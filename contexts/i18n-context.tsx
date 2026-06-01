"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";

export type Locale = "en" | "ar";

const STORAGE_KEY = "emcoin-locale";

// Translation dictionary. Keys are stable identifiers; English is the source.
// Only UI chrome strings live here; data from the API is shown as-is.
const messages: Record<string, { en: string; ar: string }> = {
  // nav
  "nav.dashboard": { en: "Dashboard", ar: "لوحة المعلومات" },
  "nav.portfolio": { en: "Portfolio", ar: "المحفظة الاستثمارية" },
  "nav.statements": { en: "Statements", ar: "كشوف الحساب" },
  "nav.requests": { en: "Requests", ar: "الطلبات" },
  "nav.profile": { en: "Profile & Settings", ar: "الحساب والإعدادات" },
  "nav.clients": { en: "Clients", ar: "العملاء" },
  "nav.products": { en: "Products", ar: "المنتجات" },
  "nav.portfolios": { en: "Portfolios", ar: "المحافظ" },
  "nav.pricing": { en: "Pricing", ar: "الأسعار" },
  "nav.approvals": { en: "Approvals", ar: "الاعتمادات" },
  "nav.settings": { en: "Settings", ar: "الإعدادات" },
  "nav.master": { en: "Master Admin", ar: "الإدارة الرئيسية" },
  "nav.backoffice": { en: "Backoffice", ar: "العمليات" },
  "nav.portfolioSection": { en: "Portfolio", ar: "الاستثمار" },
  "common.administrator": { en: "Administrator", ar: "مسؤول النظام" },
  "common.clientAccount": { en: "Client account", ar: "حساب عميل" },
  "common.signOut": { en: "Sign out", ar: "تسجيل الخروج" },
  // profile page
  "profile.title": { en: "Profile & Settings", ar: "الحساب والإعدادات" },
  "profile.subtitle": {
    en: "Manage your account, security, and appearance.",
    ar: "تحكّم في حسابك وإعدادات الأمان والمظهر."
  },
  "profile.account": { en: "Account", ar: "بيانات الحساب" },
  "profile.name": { en: "Name", ar: "الاسم" },
  "profile.email": { en: "Email", ar: "البريد الإلكتروني" },
  "profile.accountType": { en: "Account type", ar: "نوع الحساب" },
  "profile.status": { en: "Status", ar: "الحالة" },
  "profile.appearance": { en: "Appearance", ar: "المظهر" },
  "profile.darkMode": { en: "Dark mode", ar: "الوضع الداكن" },
  "profile.darkModeDesc": {
    en: "Switch between light and dark themes. Your choice is saved on this device.",
    ar: "بدّل بين الوضع الفاتح والداكن، وسيُحفظ اختيارك على هذا الجهاز."
  },
  "profile.language": { en: "Language", ar: "اللغة" },
  "profile.languageDesc": {
    en: "Choose your preferred interface language.",
    ar: "اختر لغة العرض التي تناسبك."
  },
  "profile.changePassword": { en: "Change password", ar: "تغيير كلمة المرور" },
  "profile.currentPassword": { en: "Current password", ar: "كلمة المرور الحالية" },
  "profile.newPassword": { en: "New password", ar: "كلمة المرور الجديدة" },
  "profile.confirmPassword": { en: "Confirm new password", ar: "تأكيد كلمة المرور الجديدة" },
  "profile.updatePassword": { en: "Update password", ar: "حفظ كلمة المرور" },
  // assistant widget
  "assistant.title": { en: "Assistant", ar: "المساعد" },
  "assistant.subtitle": { en: "General help & platform support", ar: "مساعدة ودعم في استخدام المنصة" },
  "assistant.disclaimer": {
    en: "Information & support only — no investment advice or price predictions.",
    ar: "للمعلومات والدعم فقط — لا يقدّم توصيات استثمارية أو توقعات للأسعار."
  },
  "assistant.greeting": {
    en: "Hi! Ask me anything about using the platform.",
    ar: "مرحباً! اسألني عن أي شيء يخص استخدام المنصة."
  },
  "assistant.placeholder": { en: "Type your question…", ar: "اكتب سؤالك هنا…" },
  "assistant.unavailable": {
    en: "The assistant is currently unavailable.",
    ar: "المساعد غير متاح حالياً."
  }
};

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const current = document.documentElement.getAttribute("lang");
    if (current === "ar" || current === "en") setLocaleState(current);
  }, []);

  const apply = useCallback((l: Locale) => {
    setLocaleState(l);
    const dir = l === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", l);
    document.documentElement.setAttribute("dir", dir);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLocale = useCallback(() => {
    const current = document.documentElement.getAttribute("lang");
    apply(current === "ar" ? "en" : "ar");
  }, [apply]);

  const t = useCallback(
    (key: string) => {
      const entry = messages[key];
      if (!entry) return key;
      return entry[locale] ?? entry.en;
    },
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{ locale, dir: locale === "ar" ? "rtl" : "ltr", t, setLocale: apply, toggleLocale }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
