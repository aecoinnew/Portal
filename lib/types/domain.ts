export type UserRole = "client" | "admin";
export type UserStatus = "active" | "suspended";
export type ProductType = "stock" | "crypto" | "fund" | "sukuk" | "private";
export type PricingMode = "api" | "manual";
export type PriceSource = "api" | "manual";
export type SupportedCurrency = "AED" | "USD";
export type RequestType = "buy" | "sell" | "subscribe" | "withdraw";
export type RequestStatus = "pending" | "approved" | "rejected" | "executed";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export type ClientUser = AuthUser & {
  phone?: string | null;
  relationshipManager?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  symbol?: string | null;
  type: ProductType;
  pricingMode: PricingMode;
  currency: SupportedCurrency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductPrice = {
  id: string;
  productId: string;
  price: number;
  source: PriceSource;
  updatedAt: string;
};

export type Holding = {
  positionId: string;
  userId: string;
  productId: string;
  productName: string;
  symbol?: string | null;
  type: ProductType;
  pricingMode: PricingMode;
  currency: SupportedCurrency;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  priceUpdatedAt: string | null;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
};

export type AllocationRow = {
  type: ProductType;
  value: number;
  percentage: number;
};

export type PortfolioSummary = {
  userId: string;
  totalValue: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  positionCount: number;
  assetClassCount: number;
  allocation: AllocationRow[];
  holdings: Holding[];
};

export type InvestmentRequest = {
  id: string;
  userId: string;
  clientName?: string;
  type: RequestType;
  productId?: string | null;
  productName?: string | null;
  amount?: number | null;
  currency: SupportedCurrency;
  message: string;
  status: RequestStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Statement = {
  id: string;
  userId: string;
  clientName?: string;
  period: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  adminUserId: string;
  adminName?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: string | null;
  createdAt: string;
};

export type AdminSummary = {
  totalClients: number;
  activeClients: number;
  suspendedClients: number;
  totalAum: number;
  pendingRequests: number;
  activeProducts: number;
  manualProducts: number;
  stalePrices: number;
  recentActivity: AuditLog[];
};

export type AppSettings = {
  baseCurrency: SupportedCurrency;
  allowUsd: boolean;
  updatedAt: string;
};

export type ApiErrorBody = {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};
