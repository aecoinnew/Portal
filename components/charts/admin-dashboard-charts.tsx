"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, productTypeLabel, titleCase } from "@/lib/utils/format";
import type { ProductType, RequestStatus, SupportedCurrency } from "@/lib/types/domain";

const allocationColors: Record<ProductType, string> = {
  fund: "#0B3D91",
  sukuk: "#B0944D",
  stock: "#7A93D6",
  crypto: "#5B21B6",
  private: "#9AA4B2"
};

const statusColors: Record<RequestStatus, string> = {
  pending: "#B54708",
  approved: "#175CD3",
  rejected: "#344256",
  executed: "#0B3D91"
};

export type ClientAumRow = {
  clientName: string;
  value: number;
  currency: SupportedCurrency;
};

export type AdminAllocationRow = {
  type: ProductType;
  value: number;
  percentage: number;
};

export type RequestStatusRow = {
  status: RequestStatus;
  count: number;
};

export function ClientAumChart({ data }: { data: ClientAumRow[] }) {
  if (!data.length) return <NoChartData />;

  return (
    <div className="h-[240px] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
          <CartesianGrid stroke="#EEF1F4" vertical={false} />
          <XAxis dataKey="clientName" tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} width={46} />
          <Tooltip formatter={(value) => formatMoney(Number(value), data[0]?.currency ?? "AED")} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#0B3D91" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminAllocationChart({ data }: { data: AdminAllocationRow[] }) {
  if (!data.length) return <NoChartData />;

  return (
    <div className="grid gap-3 p-4">
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="type" innerRadius={42} outerRadius={66} paddingAngle={2}>
              {data.map((row) => (
                <Cell key={row.type} fill={allocationColors[row.type]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value))} labelFormatter={(label) => productTypeLabel(label as ProductType)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-2">
        {data.map((row) => (
          <div key={row.type} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-sm" style={{ background: allocationColors[row.type] }} />
            <span className="flex-1 text-slate-700">{productTypeLabel(row.type)}</span>
            <span className="font-medium tabular-nums text-slate-900">{row.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequestStatusChart({ data }: { data: RequestStatusRow[] }) {
  if (!data.length) return <NoChartData />;

  return (
    <div className="grid gap-3 p-4">
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={42} outerRadius={66} paddingAngle={2}>
              {data.map((row) => (
                <Cell key={row.status} fill={statusColors[row.status]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => Number(value).toLocaleString("en-US")} labelFormatter={(label) => titleCase(String(label))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-2">
        {data.map((row) => (
          <div key={row.status} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-sm" style={{ background: statusColors[row.status] }} />
            <span className="flex-1 text-slate-700">{titleCase(row.status)}</span>
            <span className="font-medium tabular-nums text-slate-900">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoChartData() {
  return <div className="px-5 py-8 text-center text-[13px] text-slate-500">No chart data</div>;
}
