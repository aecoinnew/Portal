import type {
  AdminSummary,
  AppSettings,
  ClientUser,
  InvestmentRequest,
  PortfolioSummary,
  Product,
  ProductType,
  PricingMode,
  PriceSource,
  SupportedCurrency,
  Statement
} from "./domain";

export type PricingRow = {
  productId: string;
  productName: string;
  type: ProductType;
  pricingMode: PricingMode;
  currency: SupportedCurrency;
  isActive: 0 | 1 | boolean;
  priceId: string | null;
  price: number | null;
  source: PriceSource | null;
  updatedAt: string | null;
};

export type AdminPosition = {
  id: string;
  userId: string;
  clientName: string;
  productId: string;
  productName: string;
  type: ProductType;
  quantity: number;
  avgPrice: number;
  currentPrice: number | null;
  costBasis: number;
  marketValue: number;
  unrealizedPnL: number;
  currency: SupportedCurrency;
  updatedAt: string;
};

export type AuthResponse = {
  token: string;
  user: import("./domain").AuthUser;
};

export type PortfolioResponse = { portfolio: PortfolioSummary };
export type RequestsResponse = { requests: InvestmentRequest[] };
export type RequestResponse = { request: InvestmentRequest };
export type StatementsResponse = { statements: Statement[] };
export type StatementResponse = { statement: Statement };
export type ProductsResponse = { products: Product[] };
export type ProductResponse = { product: Product };
export type ClientsResponse = { clients: ClientUser[] };
export type ClientResponse = { client: ClientUser };
export type PricingResponse = { pricing: PricingRow[] };
export type AdminSummaryResponse = { summary: AdminSummary };
export type PositionsResponse = { positions: AdminPosition[] };
export type SettingsResponse = { settings: AppSettings };
