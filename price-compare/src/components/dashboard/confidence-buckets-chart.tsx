"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ConfidenceBucketsChart({
  data,
}: {
  data: Array<{ bucket: string; count: number }>;
}) {
  const bucketColors = ["var(--chart-4)", "var(--chart-3)", "var(--chart-2)"];

  if (!data.length) {
    return (
      <div className="h-72 border rounded p-3 flex flex-col">
        <h3 className="text-sm font-semibold mb-2">Confidence distribution</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-foreground/50">
          No confidence data available.
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 border rounded p-3">
      <h3 className="text-sm font-semibold mb-2">Confidence distribution</h3>
      <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count">
            {data.map((item, index) => (
              <Cell key={item.bucket} fill={bucketColors[index] ?? "var(--chart-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
