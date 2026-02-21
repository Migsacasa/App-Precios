"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function TrendChart({ data }: { data: { date: string; index: number }[] }) {
  if (!data.length) {
    return (
      <div className="h-72 border rounded p-3 flex flex-col">
        <h3 className="text-sm font-semibold mb-2">Index trend (vs our price)</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-foreground/50">
          No trend data available for the selected period.
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 border rounded p-3">
      <h3 className="text-sm font-semibold mb-2">Index trend (vs our price)</h3>
      <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="index" stroke="#3b82f6" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
