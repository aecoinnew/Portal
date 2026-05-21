import type {
  ApprovalRequest,
  AuditLog,
  ClientUser,
  InvestmentRequest,
  Product,
  ProductPrice,
  Statement
} from "../../lib/types/domain.js";

export function mapClient(row: Record<string, unknown>): ClientUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as ClientUser["role"],
    status: row.status as ClientUser["status"],
    phone: (row.phone as string | null) ?? null,
    relationshipManager: (row.relationship_manager as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    symbol: (row.symbol as string | null) ?? null,
    type: row.type as Product["type"],
    pricingMode: row.pricing_mode as Product["pricingMode"],
    currency: row.currency as Product["currency"],
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapPrice(row: Record<string, unknown>): ProductPrice {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    price: Number(row.price),
    source: row.source as ProductPrice["source"],
    updatedAt: String(row.updated_at)
  };
}

export function mapRequest(row: Record<string, unknown>): InvestmentRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    clientName: (row.client_name as string | undefined) ?? undefined,
    type: row.type as InvestmentRequest["type"],
    productId: (row.product_id as string | null) ?? null,
    productName: (row.product_name as string | null) ?? null,
    amount: row.amount == null ? null : Number(row.amount),
    currency: (row.currency as InvestmentRequest["currency"]) ?? "AED",
    message: String(row.message ?? ""),
    status: row.status as InvestmentRequest["status"],
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapStatement(row: Record<string, unknown>): Statement {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    clientName: (row.client_name as string | undefined) ?? undefined,
    period: String(row.period),
    fileName: String(row.file_name),
    fileSize: Number(row.file_size ?? 0),
    createdAt: String(row.created_at)
  };
}

export function mapApproval(row: Record<string, unknown>): ApprovalRequest {
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    action: String(row.action),
    requestedByUserId: String(row.requested_by_user_id),
    requestedByName: (row.requested_by_name as string | null) ?? undefined,
    assignedRole: (row.assigned_role as string | null) ?? null,
    status: row.status as ApprovalRequest["status"],
    beforeValue: (row.before_value as string | null) ?? null,
    afterValue: (row.after_value as string | null) ?? null,
    reason: (row.reason as string | null) ?? null,
    decisionByUserId: (row.decision_by_user_id as string | null) ?? null,
    decisionByName: (row.decision_by_name as string | null) ?? undefined,
    decisionReason: (row.decision_reason as string | null) ?? null,
    createdAt: String(row.created_at),
    decidedAt: (row.decided_at as string | null) ?? null,
    executedAt: (row.executed_at as string | null) ?? null
  };
}

export function mapAudit(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    adminUserId: String(row.admin_user_id),
    adminName: (row.admin_name as string | undefined) ?? undefined,
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    metadata: (row.metadata as string | null) ?? null,
    createdAt: String(row.created_at)
  };
}
