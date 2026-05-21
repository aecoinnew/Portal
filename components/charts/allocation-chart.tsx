"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AllocationRow } from "@/lib/types/domain";
import { formatMoney, productTypeLabel } from "@/lib/utils/format";

const colors: Record<string, string> = {
  fund: "#0B3D91",
  sukuk: "#B0944D",
  stock: "#7A93D6",
  crypto: "#5B21B6",
  private: "#9AA4B2"
};

export function AllocationChart({ allocation }: { allocation: AllocationRow[] }) {
  if (!allocation.length) {
    return <div className="px-5 py-8 text-center text-[13px] text-slate-500">No allocation data</div>;
  }

  return (
    <div className="grid gap-4 p-5">
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={allocation} dataKey="value" nameKey="type" innerRadius={48} outerRadius={76} paddingAngle={2}>
              {allocation.map((row) => (
                <Cell key={row.type} fill={colors[row.type] ?? "#6B7280"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatMoney(Number(value))}
              labelFormatter={(label) => productTypeLabel(label as AllocationRow["type"])}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-2">
        {allocation.map((row) => (
          <div key={row.type} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-sm" style={{ background: colors[row.type] ?? "#6B7280" }} />
            <span className="flex-1 text-slate-700">{productTypeLabel(row.type)}</span>
            <span className="font-medium tabular-nums text-slate-900">{row.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
