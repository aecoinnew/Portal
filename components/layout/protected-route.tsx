"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth, roleHome } from "@/contexts/auth-context";
import { isAdminRole, type UserRole } from "@/lib/types/domain";

export function ProtectedRoute({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role === "admin" && !isAdminRole(user.role)) {
      router.replace(roleHome(user.role));
      return;
    }
    if (role === "client" && isAdminRole(user.role)) {
      router.replace(roleHome(user.role));
      return;
    }
    if (user.role !== role && role !== "admin") {
      router.replace(roleHome(user.role));
    }
  }, [loading, role, router, user]);

  const isAuthorized = () => {
    if (!user) return false;
    if (role === "admin") return isAdminRole(user.role);
    if (role === "client") return user.role === "client";
    return user.role === role;
  };

  if (loading || !user || !isAuthorized()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600 shadow-card">
          Loading secure session
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
