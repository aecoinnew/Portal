"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CircleDollarSign,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  UserRound,
  UserRoundCog,
  UsersRound,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useI18n } from "@/contexts/i18n-context";
import { NotificationBell } from "@/components/layout/notification-bell";
import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";
import type { UserRole } from "@/lib/types/domain";

type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  badge?: number;
};

const clientNav: NavItem[] = [
  { href: "/client/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/client/portfolio", labelKey: "nav.portfolio", icon: TrendingUp },
  { href: "/client/statements", labelKey: "nav.statements", icon: FileText },
  { href: "/client/requests", labelKey: "nav.requests", icon: Clock3 },
  { href: "/client/profile", labelKey: "nav.profile", icon: UserRound }
];

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", labelKey: "nav.clients", icon: UsersRound },
  { href: "/admin/products", labelKey: "nav.products", icon: Package },
  { href: "/admin/portfolios", labelKey: "nav.portfolios", icon: TrendingUp },
  { href: "/admin/pricing", labelKey: "nav.pricing", icon: CircleDollarSign },
  { href: "/admin/requests", labelKey: "nav.requests", icon: Clock3 },
  { href: "/admin/statements", labelKey: "nav.statements", icon: FileText },
  { href: "/admin/approvals", labelKey: "nav.approvals", icon: ShieldCheck },
  { href: "/admin/settings", labelKey: "nav.settings", icon: Settings }
];

const AUDIT_VIEW_ROLES = ["super_admin", "admin", "compliance", "auditor"];

export function PortalShell({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, locale, toggleLocale } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const admin = role === "admin";
  const isSuperAdmin = user?.role === "super_admin";
  const canViewAudit = user ? AUDIT_VIEW_ROLES.includes(user.role) : false;
  const nav = admin
    ? [
        ...adminNav,
        ...(canViewAudit ? [{ href: "/admin/audit", labelKey: "nav.audit", icon: ScrollText }] : []),
        ...(isSuperAdmin ? [{ href: "/admin/master", labelKey: "nav.master", icon: UserRoundCog }] : [])
      ]
    : clientNav;
  const active = nav.find((item) => pathname.startsWith(item.href));
  const title = active ? t(active.labelKey) : admin ? t("nav.backoffice") : t("nav.portfolioSection");
  const timestamp = new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll while the mobile drawer is open.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const sidebarBody = (
    <>
      <div className={cn("flex items-center justify-between border-b px-5 py-5", admin ? "border-white/10" : "border-slate-200")}>
        <BrandLogo variant={admin ? "light" : "auto"} size={24} />
        <button
          className={cn("rounded p-1 lg:hidden", admin ? "text-white/70 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100")}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <NavSection label={admin ? t("nav.backoffice") : t("nav.portfolioSection")} admin={admin} />
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "mb-1 flex h-[38px] items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition",
              pathname.startsWith(item.href)
                ? admin
                  ? "bg-white/15 text-white"
                  : "bg-navy-50 text-navy-700"
                : admin
                  ? "text-white/65 hover:bg-white/10 hover:text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <item.icon className="h-[15px] w-[15px] shrink-0" />
            <span>{t(item.labelKey)}</span>
            {item.badge ? <span className="ms-auto rounded-full bg-gold px-1.5 text-[10px] text-white">{item.badge}</span> : null}
          </Link>
        ))}
      </nav>

      <div className={cn("border-t p-2.5", admin ? "border-white/10" : "border-slate-200")}>
        <div className={cn("flex items-center gap-2.5 rounded-md p-2", admin ? "hover:bg-white/10" : "hover:bg-slate-100")}>
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              admin ? "bg-white/15 text-white" : "bg-navy-700 text-white"
            )}
          >
            {initials(user?.name ?? "")}
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn("truncate text-[12px] font-medium", admin ? "text-white" : "text-slate-900")}>{user?.name}</div>
            <div className={cn("text-[10px]", admin ? "text-white/45" : "text-slate-500")}>
              {admin ? t("common.administrator") : t("common.clientAccount")}
            </div>
          </div>
          <button className={cn("rounded p-1.5", admin ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-200")} onClick={logout} title={t("common.signOut")}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-[248px] shrink-0 flex-col lg:flex",
          admin ? "bg-navy-700 text-white" : "border-r border-slate-200 bg-white text-slate-900"
        )}
      >
        {sidebarBody}
      </aside>

      {/* Mobile drawer + backdrop */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside
            className={cn(
              "absolute inset-y-0 start-0 flex w-[80%] max-w-[300px] flex-col shadow-2xl",
              admin ? "bg-navy-700 text-white" : "bg-white text-slate-900"
            )}
          >
            {sidebarBody}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1 lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:gap-3 lg:px-6">
          <button
            className="rounded-md p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="lg:hidden">
            <BrandLogo variant="auto" size={20} />
          </span>
          <div className="hidden font-display text-[16px] font-semibold text-slate-900 sm:block">{title}</div>
          <div className="ms-auto hidden text-[12px] text-slate-500 md:block">{timestamp}</div>
          {admin ? <NotificationBell /> : null}
          <button
            className="rounded-md px-2 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-100"
            onClick={toggleLocale}
            title={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            aria-label="Toggle language"
          >
            {locale === "ar" ? "EN" : "ع"}
          </button>
          <button
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}

function NavSection({ label, admin }: { label: string; admin: boolean }) {
  return (
    <div className={cn("px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase", admin ? "text-white/35" : "text-slate-400")}>
      {label}
    </div>
  );
}
