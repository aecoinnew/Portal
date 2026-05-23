"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  CircleDollarSign,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserRoundCog,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { BRAND } from "@/lib/branding/config";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";
import type { UserRole } from "@/lib/types/domain";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

const clientNav: NavItem[] = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/portfolio", label: "Portfolio", icon: TrendingUp },
  { href: "/client/statements", label: "Statements", icon: FileText },
  { href: "/client/requests", label: "Requests", icon: Clock3 }
];

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: UsersRound },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/portfolios", label: "Portfolios", icon: TrendingUp },
  { href: "/admin/pricing", label: "Pricing", icon: CircleDollarSign },
  { href: "/admin/requests", label: "Requests", icon: Clock3 },
  { href: "/admin/statements", label: "Statements", icon: FileText },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

export function PortalShell({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const admin = role === "admin";
  const nav = admin ? adminNav : clientNav;
  const active = nav.find((item) => pathname.startsWith(item.href));
  const title = active?.label ?? (admin ? "Admin" : "Client portal");
  const timestamp = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-[248px] shrink-0 flex-col lg:flex",
          admin ? "bg-navy-700 text-white" : "border-r border-slate-200 bg-white text-slate-900"
        )}
      >
        <div className={cn("border-b px-5 py-5", admin ? "border-white/10" : "border-slate-200")}>
          <img
            src={BRAND.logoUrl}
            alt={BRAND.name}
            className={cn("h-9 w-auto object-contain", admin && "brightness-0 invert")}
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <NavSection label={admin ? "Backoffice" : "Portfolio"} admin={admin} />
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1 flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition",
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
              <span>{item.label}</span>
              {item.badge ? <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] text-white">{item.badge}</span> : null}
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
                {admin ? "Administrator" : "Client account"}
              </div>
            </div>
            <button className={cn("rounded p-1.5", admin ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-200")} onClick={logout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <img src={BRAND.logoUrl} alt={BRAND.name} className="h-8 w-auto object-contain lg:hidden" />
          <div className="font-display text-[16px] font-semibold text-slate-900">{admin ? `Admin ${title.toLowerCase()}` : title}</div>
          <div className="ml-auto hidden text-[12px] text-slate-500 sm:block">{timestamp}</div>
          <button className="btn btn-secondary lg:hidden" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium",
                  pathname.startsWith(item.href) ? "bg-navy-50 text-navy-700" : "text-slate-600"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <main className="max-w-[1280px] px-4 py-5 lg:px-6 lg:py-6">{children}</main>
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
