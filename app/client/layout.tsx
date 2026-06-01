"use client";

import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { FloatingAssistant } from "@/components/assistant/floating-assistant";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute role="client">
      <PortalShell role="client">{children}</PortalShell>
      <FloatingAssistant />
    </ProtectedRoute>
  );
}
