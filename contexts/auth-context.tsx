"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api/client";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/auth/storage";
import type { AuthUser, UserRole } from "@/lib/types/domain";
import { isAdminRole } from "@/lib/types/domain";

export type LoginResult =
  | { kind: "ok"; user: AuthUser; mustChangePassword: boolean; mfaEnabled: boolean; mustEnrollMfa: boolean }
  | { kind: "mfa_required"; email: string };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<LoginResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: AuthUser }>("/auth/me", { token: stored });
      setToken(stored);
      setUser(data.user);
    } catch {
      clearStoredToken();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string, mfaCode?: string): Promise<LoginResult> => {
    const data = await apiRequest<{
      token?: string;
      user?: AuthUser;
      mfaRequired?: boolean;
      email?: string;
      mustChangePassword?: boolean;
      mfaEnabled?: boolean;
      mustEnrollMfa?: boolean;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
      token: null
    });

    if (data.mfaRequired) {
      return { kind: "mfa_required", email: data.email ?? email };
    }
    if (!data.token || !data.user) {
      throw new Error("Login response missing token or user");
    }
    setStoredToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return {
      kind: "ok",
      user: data.user,
      mustChangePassword: Boolean(data.mustChangePassword),
      mfaEnabled: Boolean(data.mfaEnabled),
      mustEnrollMfa: Boolean(data.mustEnrollMfa)
    };
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, refreshUser }),
    [user, token, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function roleHome(role: UserRole): string {
  if (isAdminRole(role)) {
    return "/admin/dashboard";
  }
  return "/client/dashboard";
}
