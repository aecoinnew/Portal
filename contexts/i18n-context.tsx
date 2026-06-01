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
  "nav.audit": { en: "Audit Log", ar: "سجل التدقيق" },
  "notif.title": { en: "Notifications", ar: "التنبيهات" },
  "notif.empty": { en: "You're all caught up.", ar: "لا توجد تنبيهات جديدة." },
  "notif.approvals": { en: "Pending approvals", ar: "اعتمادات قيد الانتظار" },
  "notif.resets": { en: "Password reset requests", ar: "طلبات إعادة تعيين كلمة المرور" },
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
  },

  // shared / common
  "common.viewAll": { en: "View all", ar: "عرض الكل" },
  "common.download": { en: "Download PDF", ar: "تحميل PDF" },
  "common.submit": { en: "Submit", ar: "إرسال" },
  "common.dismiss": { en: "Dismiss", ar: "إغلاق" },
  "common.all": { en: "All", ar: "الكل" },
  "common.cash": { en: "Cash", ar: "نقد" },
  // table headers
  "tbl.instrument": { en: "Instrument", ar: "الأداة" },
  "tbl.type": { en: "Type", ar: "النوع" },
  "tbl.qty": { en: "Qty", ar: "الكمية" },
  "tbl.quantity": { en: "Quantity", ar: "الكمية" },
  "tbl.avgPrice": { en: "Avg price", ar: "متوسط السعر" },
  "tbl.average": { en: "Average", ar: "المتوسط" },
  "tbl.current": { en: "Current", ar: "السعر الحالي" },
  "tbl.value": { en: "Value", ar: "القيمة" },
  "tbl.unrealizedPnl": { en: "Unr. P/L", ar: "ربح/خسارة غير محققة" },
  "tbl.priceTime": { en: "Price time", ar: "وقت السعر" },
  "tbl.product": { en: "Product", ar: "المنتج" },
  "tbl.amount": { en: "Amount", ar: "المبلغ" },
  "tbl.status": { en: "Status", ar: "الحالة" },
  "tbl.submitted": { en: "Submitted", ar: "تاريخ الإرسال" },
  "tbl.notes": { en: "Notes", ar: "ملاحظات" },
  // dashboard
  "dash.greeting": { en: "Good afternoon.", ar: "أهلاً بك." },
  "dash.summary": { en: "Here is a summary of your portfolio as of today.", ar: "هذا ملخّص محفظتك حتى اليوم." },
  "dash.pricesAsOf": { en: "Prices as of", ar: "الأسعار حتى" },
  "dash.portfolioValue": { en: "Portfolio value", ar: "قيمة المحفظة" },
  "dash.unrealizedPnl": { en: "Unrealized P/L", ar: "ربح/خسارة غير محققة" },
  "dash.positions": { en: "Positions", ar: "المراكز" },
  "dash.openRequests": { en: "Open requests", ar: "الطلبات المفتوحة" },
  "dash.pendingReview": { en: "Pending review", ar: "قيد المراجعة" },
  "dash.positionsCount": { en: "positions", ar: "مركز" },
  "dash.assetClasses": { en: "asset classes", ar: "فئة أصول" },
  "dash.totalSuffix": { en: "total", ar: "إجمالي" },
  "dash.holdings": { en: "Holdings", ar: "الأصول المملوكة" },
  "dash.assetAllocation": { en: "Asset allocation", ar: "توزيع الأصول" },
  "dash.recentRequests": { en: "Recent requests", ar: "أحدث الطلبات" },
  "dash.statements": { en: "Statements", ar: "كشوف الحساب" },
  "dash.noRequests": { en: "No requests submitted", ar: "لا توجد طلبات مُقدّمة" },
  "dash.noStatements": { en: "No statements available", ar: "لا توجد كشوف متاحة" },
  "dash.noData": { en: "No portfolio data available", ar: "لا توجد بيانات للمحفظة" },
  "dash.cashWithdrawal": { en: "Cash withdrawal", ar: "سحب نقدي" },
  "dash.amountNotSpecified": { en: "Amount not specified", ar: "المبلغ غير محدد" },
  "dash.statementSuffix": { en: "Statement", ar: "كشف حساب" },
  "dash.issued": { en: "Issued", ar: "صدر في" },
  // portfolio
  "port.title": { en: "Portfolio", ar: "المحفظة الاستثمارية" },
  "port.subtitle": { en: "Detailed holdings, latest prices, and unrealized P/L.", ar: "تفاصيل الأصول وأحدث الأسعار والأرباح غير المحققة." },
  "port.assetClasses": { en: "Asset classes", ar: "فئات الأصول" },
  "port.byProductType": { en: "By product type", ar: "حسب نوع المنتج" },
  "port.filteredRows": { en: "Filtered rows", ar: "النتائج المعروضة" },
  "port.allHoldings": { en: "All holdings", ar: "كل الأصول" },
  "port.allocation": { en: "Allocation", ar: "التوزيع" },
  "port.noMatch": { en: "No holdings match this filter", ar: "لا توجد أصول تطابق هذه التصفية" },
  "port.live": { en: "live", ar: "مباشر" },
  "port.manual": { en: "manual", ar: "يدوي" },
  "port.weight": { en: "Weight", ar: "الوزن" },
  "port.topGainer": { en: "Top gainer", ar: "أعلى رابح" },
  "port.topLoser": { en: "Top loser", ar: "أكبر خاسر" },
  "port.export": { en: "Export CSV", ar: "تصدير CSV" },
  "port.ofPortfolio": { en: "of portfolio", ar: "من المحفظة" },
  "port.none": { en: "None", ar: "لا يوجد" },
  // dashboard top holdings summary
  "dash.topHoldings": { en: "Top holdings", ar: "أكبر الأصول" },
  "dash.viewFullPortfolio": { en: "View full portfolio", ar: "عرض المحفظة كاملة" },
  // statements
  "stmt.title": { en: "Statements", ar: "كشوف الحساب" },
  "stmt.subtitle": { en: "Portfolio reports and account statements.", ar: "تقارير المحفظة وكشوف الحساب." },
  "stmt.available": { en: "Available statements", ar: "الكشوف المتاحة" },
  "stmt.none": { en: "No statements are available", ar: "لا توجد كشوف متاحة" },
  // requests
  "req.title": { en: "Requests", ar: "الطلبات" },
  "req.subtitle": { en: "Investment instructions and servicing requests.", ar: "تعليمات الاستثمار وطلبات الخدمة." },
  "req.howTitle": { en: "How requests work", ar: "كيف تُعالَج الطلبات" },
  "req.submit": { en: "Submit request", ar: "تقديم طلب" },
  "req.submitting": { en: "Submitting…", ar: "جارٍ الإرسال…" },
  "req.fieldType": { en: "Type", ar: "النوع" },
  "req.buy": { en: "Buy", ar: "شراء" },
  "req.sell": { en: "Sell", ar: "بيع" },
  "req.subscribe": { en: "Subscribe", ar: "اكتتاب" },
  "req.withdraw": { en: "Withdraw cash", ar: "سحب نقدي" },
  "req.fieldProduct": { en: "Product", ar: "المنتج" },
  "req.optional": { en: "(optional)", ar: "(اختياري)" },
  "req.notApplicable": { en: "Not applicable", ar: "غير مطلوب" },
  "req.selectProduct": { en: "Select a product", ar: "اختر منتجاً" },
  "req.fieldAmount": { en: "Amount", ar: "المبلغ" },
  "req.fieldMessage": { en: "Message", ar: "رسالة" },
  "req.messagePlaceholder": { en: "Any context for the reviewing team…", ar: "أي تفاصيل تساعد فريق المراجعة…" },
  "req.history": { en: "Request history", ar: "سجل الطلبات" },
  "req.none": { en: "No requests submitted yet", ar: "لم تُقدَّم أي طلبات بعد" },
  "req.reason": { en: "Reason:", ar: "السبب:" },
  "req.hintBuy": {
    en: "Buy a specific instrument. Select the product and the AED/USD amount you want to invest.",
    ar: "شراء أداة محددة. اختر المنتج والمبلغ بالدرهم أو الدولار الذي تريد استثماره."
  },
  "req.hintSell": {
    en: "Sell from an existing position. Select the product and the AED/USD amount you want to liquidate.",
    ar: "بيع جزء من مركز قائم. اختر المنتج والمبلغ بالدرهم أو الدولار الذي تريد تسييله."
  },
  "req.hintSubscribe": {
    en: "Subscribe to a fund or product offering. Select the product and the subscription amount.",
    ar: "الاكتتاب في صندوق أو طرح. اختر المنتج ومبلغ الاكتتاب."
  },
  "req.hintWithdraw": {
    en: "Cash withdrawal from your account. No product needed; just specify the amount.",
    ar: "سحب نقدي من حسابك. لا حاجة لاختيار منتج، فقط حدّد المبلغ."
  },
  "req.howBody": {
    en: "Submitted requests enter our review workflow. They progress through pending → approved → executed, or may be rejected with a reason. You will see status changes here as they happen.",
    ar: "الطلبات المُقدَّمة تدخل مسار المراجعة لدينا، وتمر بمراحل: قيد الانتظار ← معتمد ← مُنفَّذ، أو قد تُرفَض مع بيان السبب. ستظهر تغيّرات الحالة هنا فور حدوثها."
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
