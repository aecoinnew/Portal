import type { AllocationRow, Holding, ProductType } from "../types/domain";

export type RawHoldingInput = Omit<
  Holding,
  "currentValue" | "unrealizedPnL" | "unrealizedPnLPercent"
>;

export function calculateHolding(input: RawHoldingInput): Holding {
  const currentValue = roundMoney(input.quantity * input.currentPrice);
  const costBasis = input.quantity * input.avgPrice;
  const unrealizedPnL = roundMoney(currentValue - costBasis);
  const unrealizedPnLPercent = costBasis === 0 ? 0 : roundPercent((unrealizedPnL / costBasis) * 100);

  return {
    ...input,
    currentValue,
    unrealizedPnL,
    unrealizedPnLPercent
  };
}

export function calculatePortfolioTotals(holdings: Holding[]) {
  const totalValue = roundMoney(holdings.reduce((sum, holding) => sum + holding.currentValue, 0));
  const totalCost = holdings.reduce((sum, holding) => sum + holding.quantity * holding.avgPrice, 0);
  const totalUnrealizedPnL = roundMoney(holdings.reduce((sum, holding) => sum + holding.unrealizedPnL, 0));
  const totalUnrealizedPnLPercent = totalCost === 0 ? 0 : roundPercent((totalUnrealizedPnL / totalCost) * 100);

  return {
    totalValue,
    totalUnrealizedPnL,
    totalUnrealizedPnLPercent,
    positionCount: holdings.length,
    assetClassCount: new Set(holdings.map((holding) => holding.type)).size
  };
}

export function calculateAllocation(holdings: Holding[]): AllocationRow[] {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const byType = holdings.reduce<Record<ProductType, number>>(
    (acc, holding) => {
      acc[holding.type] = (acc[holding.type] ?? 0) + holding.currentValue;
      return acc;
    },
    {} as Record<ProductType, number>
  );

  return Object.entries(byType)
    .map(([type, value]) => ({
      type: type as ProductType,
      value: roundMoney(value),
      percentage: totalValue === 0 ? 0 : roundPercent((value / totalValue) * 100)
    }))
    .sort((a, b) => b.value - a.value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
