"use client";

import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { ProtectedRoute } from "@/components/layout/protected-route";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute role="admin">
      <PortalShell role="admin">{children}</PortalShell>
    </ProtectedRoute>
  );
}
