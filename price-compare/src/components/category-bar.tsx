"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function CategoryBar({ data }: { data: { category: string; index: number }[] }) {
  if (!data.length) {
    return (
      <div className="h-72 border rounded p-3 flex flex-col">
        <h3 className="text-sm font-semibold mb-2">Index by category</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-foreground/50">
          No category data available.
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 border rounded p-3">
      <h3 className="text-sm font-semibold mb-2">Index by category</h3>
      <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="index" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
