"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/lib/api/client";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

type HistoryPoint = {
  id: string;
  price: number;
  source: string;
  createdAt: string;
};

type HistoryResponse = {
  product: { id: string; name: string; symbol: string | null; pricingMode: string; currency: string };
  history: HistoryPoint[];
};

export function PriceHistoryChart({ productId }: { productId: string }) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiRequest<HistoryResponse>(`/pricing/${productId}/history?limit=100`)
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <div className="px-5 py-6 text-[12px] text-slate-500">Loading price history...</div>;
  if (error) return <div className="px-5 py-6 text-[12px] text-amber-700">{error}</div>;
  if (!data || data.history.length === 0) {
    return <div className="px-5 py-6 text-[12px] text-slate-500">No price history yet.</div>;
  }

  // Reverse so chart goes left-to-right by time
  const chartData = [...data.history].reverse().map((h) => ({
    ts: h.createdAt,
    label: new Date(h.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
    price: h.price,
    source: h.source
  }));

  const first = chartData[0]?.price ?? 0;
  const last = chartData[chartData.length - 1]?.price ?? 0;
  const change = last - first;
  const changePct = first ? (change / first) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="grid gap-3 p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[12px] font-medium text-slate-700">{data.product.name}</div>
          <div className="font-mono text-[10px] text-slate-500">
            {data.product.symbol ?? "—"} · {data.product.pricingMode === "api" ? "Market" : "Manual"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[18px] font-semibold tabular-nums text-slate-900">
            {formatNumber(last, 2)} {data.product.currency}
          </div>
          <div className={`text-[11px] tabular-nums ${isUp ? "text-emerald-700" : "text-rose-700"}`}>
            {isUp ? "+" : ""}{formatNumber(change, 2)} ({changePct.toFixed(2)}%)
          </div>
        </div>
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} domain={["auto", "auto"]} width={60} />
            <Tooltip
              formatter={(value: number) => [`${formatNumber(value, 2)} ${data.product.currency}`, "Price"]}
              labelFormatter={(label, payload) => {
                const point = payload?.[0]?.payload;
                return point ? formatDateTime(point.ts) : label;
              }}
              contentStyle={{ fontSize: 11, padding: "4px 8px" }}
            />
            <Line type="monotone" dataKey="price" stroke={isUp ? "#0B3D91" : "#9F1239"} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10px] text-slate-400">
        {chartData.length} data points · {chartData[0]?.label} - {chartData[chartData.length - 1]?.label}
      </div>
    </div>
  );
}
