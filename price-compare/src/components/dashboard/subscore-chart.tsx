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

export function SubScoreChart({
  data,
}: {
  data: Array<{ metric: string; score: number }>;
}) {
  const metricColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

  if (!data.length) {
    return (
      <div className="h-72 border rounded p-3 flex flex-col">
        <h3 className="text-sm font-semibold mb-2">AI sub-score averages</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-foreground/50">
          No sub-score data available.
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 border rounded p-3">
      <h3 className="text-sm font-semibold mb-2">AI sub-score averages (0–25)</h3>
      <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="metric" />
          <YAxis domain={[0, 25]} />
          <Tooltip />
          <Bar dataKey="score">
            {data.map((item, index) => (
              <Cell key={item.metric} fill={metricColors[index] ?? "var(--chart-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
