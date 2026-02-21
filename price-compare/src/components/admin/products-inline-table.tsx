"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetchJson, formatApiError } from "@/lib/api-client";

type ProductRow = {
  id: string;
  sku: string;
  segment: "LUBRICANTS" | "BATTERIES" | "TIRES";
  name: string;
  brand: string;
  category: string;
  active: boolean;
};

export function ProductsInlineTable({ initialRows }: { initialRows: ProductRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function saveRow(row: ProductRow) {
    setSavingId(row.id);
    try {
      await apiFetchJson<{ ok: true }>(`/api/products/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: row.sku,
          segment: row.segment,
          name: row.name,
          brand: row.brand,
          category: row.category,
          active: row.active,
        }),
      });

      toast.success(`Updated ${row.name}`);
    } catch (error) {
      toast.error(formatApiError(error, "Failed to update"));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">SKU</th>
            <th className="text-left p-2">Segment</th>
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Brand</th>
            <th className="text-left p-2">Category</th>
            <th className="text-left p-2">Active</th>
            <th className="text-right p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="border-t">
              <td className="p-2">
                <input
                  className="w-28 border rounded px-2 py-1 bg-white text-black"
                  value={row.sku}
                  onChange={(event) => {
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, sku: event.target.value } : item)));
                  }}
                />
              </td>
              <td className="p-2">
                <select
                  className="border rounded px-2 py-1"
                  value={row.segment}
                  onChange={(event) => {
                    const value = event.target.value as ProductRow["segment"];
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, segment: value } : item)));
                  }}
                >
                  <option value="LUBRICANTS">LUBRICANTS</option>
                  <option value="BATTERIES">BATTERIES</option>
                  <option value="TIRES">TIRES</option>
                </select>
              </td>
              <td className="p-2">
                <input
                  className="border rounded px-2 py-1 bg-white text-black"
                  value={row.name}
                  onChange={(event) => {
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)));
                  }}
                />
              </td>
              <td className="p-2">
                <input
                  className="border rounded px-2 py-1 bg-white text-black"
                  value={row.brand}
                  onChange={(event) => {
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, brand: event.target.value } : item)));
                  }}
                />
              </td>
              <td className="p-2">
                <input
                  className="border rounded px-2 py-1 bg-white text-black"
                  value={row.category}
                  onChange={(event) => {
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, category: event.target.value } : item)));
                  }}
                />
              </td>
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(event) => {
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, active: event.target.checked } : item)));
                  }}
                />
              </td>
              <td className="p-2 text-right">
                <button
                  className="border rounded px-3 py-1"
                  onClick={() => saveRow(row)}
                  disabled={savingId === row.id}
                >
                  {savingId === row.id ? "Saving…" : "Save"}
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="p-4 text-gray-500" colSpan={7}>
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
