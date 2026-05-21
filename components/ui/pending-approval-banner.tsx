import { Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Phase 3.5: Banner shown after a controlled admin action that returned
 * { pending: true, approvalId }. Makes it explicit that the change has NOT
 * been applied yet.
 */
export function PendingApprovalBanner({ approvalId }: { approvalId: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-900">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <div className="font-medium">Submitted for approval</div>
        <div className="mt-0.5 text-blue-700">
          The change has not been applied. It is now waiting for an eligible
          approver. Approval ID:{" "}
          <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[11px]">
            {approvalId}
          </code>
        </div>
        <Link
          href="/admin/approvals"
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-blue-700 hover:text-blue-900"
        >
          Open approvals queue
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
