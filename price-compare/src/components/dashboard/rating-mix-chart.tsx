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

export function RatingMixChart({
  data,
}: {
  data: Array<{ rating: string; count: number }>;
}) {
  const colorMap: Record<string, string> = {
    GOOD: "var(--chart-2)",
    REGULAR: "var(--chart-3)",
    BAD: "var(--chart-4)",
    NEEDS_REVIEW: "var(--chart-1)",
  };

  if (!data.length) {
    return (
      <div className="h-72 border rounded p-3 flex flex-col">
        <h3 className="text-sm font-semibold mb-2">Rating distribution</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-foreground/50">
          No rating data available.
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 border rounded p-3">
      <h3 className="text-sm font-semibold mb-2">Rating distribution</h3>
      <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="rating" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count">
            {data.map((item) => (
              <Cell key={item.rating} fill={colorMap[item.rating] ?? "var(--chart-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
