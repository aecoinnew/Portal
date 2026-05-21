import type { ProductType, RequestStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";
import { productTypeLabel, titleCase } from "@/lib/utils/format";

const typeClass: Record<ProductType, string> = {
  stock: "bg-navy-50 text-navy-700",
  crypto: "bg-violet-50 text-violet-800",
  fund: "bg-sky-50 text-sky-800",
  sukuk: "border border-sand-200 bg-sand-50 text-amber-800",
  private: "border border-slate-200 bg-slate-50 text-slate-700"
};

const statusClass: Record<RequestStatus, string> = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-sky-50 text-sky-800",
  rejected: "bg-slate-100 text-slate-700",
  executed: "bg-navy-50 text-navy-700"
};

export function ProductTypeTag({ type }: { type: ProductType }) {
  return <span className={cn("tag", typeClass[type])}>{productTypeLabel(type)}</span>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <span className={cn("badge", statusClass[status])}>{titleCase(status)}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <span className={cn("badge", active ? "bg-navy-50 text-navy-700" : "bg-slate-100 text-slate-600")}>{active ? "Active" : "Inactive"}</span>;
}

export function UserStatusBadge({ status }: { status: "active" | "suspended" }) {
  return <span className={cn("badge", status === "active" ? "bg-navy-50 text-navy-700" : "bg-slate-100 text-slate-600")}>{titleCase(status)}</span>;
}
