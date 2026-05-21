import {
  calculateAllocation,
  calculateHolding,
  calculatePortfolioTotals
} from "../../lib/calculations/portfolio.js";
import type { Holding, PortfolioSummary, SupportedCurrency } from "../../lib/types/domain.js";
import { db } from "../db/connection.js";

type HoldingRow = {
  position_id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  symbol: string | null;
  type: Holding["type"];
  pricing_mode: Holding["pricingMode"];
  currency: SupportedCurrency;
  quantity: number;
  avg_price: number;
  current_price: number | null;
  price_updated_at: string | null;
};

export function getPortfolioSummary(userId: string): PortfolioSummary {
  const rows = db
    .prepare(
      `
      SELECT
        pp.id AS position_id,
        pp.user_id,
        p.id AS product_id,
        p.name AS product_name,
        p.symbol,
        p.type,
        p.pricing_mode,
        p.currency,
        pp.quantity,
        pp.avg_price,
        pr.price AS current_price,
        pr.updated_at AS price_updated_at
      FROM portfolio_positions pp
      JOIN products p ON p.id = pp.product_id
      LEFT JOIN prices pr ON pr.product_id = p.id
      WHERE pp.user_id = ?
      ORDER BY p.type, p.name
      `
    )
    .all(userId) as HoldingRow[];

  const holdings = rows.map((row) =>
    calculateHolding({
      positionId: row.position_id,
      userId: row.user_id,
      productId: row.product_id,
      productName: row.product_name,
      symbol: row.symbol,
      type: row.type,
      pricingMode: row.pricing_mode,
      currency: row.currency,
      quantity: Number(row.quantity),
      avgPrice: Number(row.avg_price),
      currentPrice: Number(row.current_price ?? 0),
      priceUpdatedAt: row.price_updated_at
    })
  );

  return {
    userId,
    ...calculatePortfolioTotals(holdings),
    allocation: calculateAllocation(holdings),
    holdings
  };
}

export function getTotalAum() {
  const clientRows = db
    .prepare("SELECT id FROM users WHERE role = 'client' AND status = 'active'")
    .all() as Array<{ id: string }>;

  return clientRows.reduce((sum, row) => sum + getPortfolioSummary(row.id).totalValue, 0);
}
