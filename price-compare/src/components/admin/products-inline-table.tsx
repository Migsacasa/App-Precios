"use client";

import { useState } from "react";
import { toast } from "sonner";

type ProductRow = {
  id: string;
  segment: "LUBRICANTS" | "BATTERIES" | "TIRES";
  productName: string;
  specs: string;
  ourPrice: number;
  referencePhotoUrl: string;
  isActive: boolean;
};

export function ProductsInlineTable({ initialRows }: { initialRows: ProductRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function saveRow(row: ProductRow) {
    setSavingId(row.id);
    try {
      const res = await fetch(`/api/products/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment: row.segment,
          productName: row.productName,
          specs: row.specs,
          ourPrice: row.ourPrice,
          referencePhotoUrl: row.referencePhotoUrl,
          isActive: row.isActive,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      toast.success(`Updated ${row.productName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">Segment</th>
            <th className="text-left p-2">Product</th>
            <th className="text-left p-2">Specs</th>
            <th className="text-right p-2">Our Price</th>
            <th className="text-left p-2">Reference Photo URL</th>
            <th className="text-left p-2">Active</th>
            <th className="text-right p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="border-t">
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
                  value={row.productName}
                  onChange={(event) => {
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, productName: event.target.value } : item)));
                  }}
                />
              </td>
              <td className="p-2">
                <input
                  className="border rounded px-2 py-1 bg-white text-black"
                  value={row.specs}
                  onChange={(event) => {
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, specs: event.target.value } : item)));
                  }}
                />
              </td>
              <td className="p-2 text-right">
                <input
                  className="w-28 border rounded px-2 py-1 text-right bg-white text-black"
                  value={row.ourPrice}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setRows((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, ourPrice: value } : item))
                    );
                  }}
                />
              </td>
              <td className="p-2">
                <input
                  className="w-full border rounded px-2 py-1 bg-white text-black"
                  value={row.referencePhotoUrl}
                  onChange={(event) => {
                    setRows((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, referencePhotoUrl: event.target.value } : item,
                      )
                    );
                  }}
                />
              </td>
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={row.isActive}
                  onChange={(event) => {
                    setRows((prev) => prev.map((item, i) => (i === index ? { ...item, isActive: event.target.checked } : item)));
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
