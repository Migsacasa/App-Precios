"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetchJson, showApiErrorToast } from "@/lib/api-client";

type ProductRow = {
  id: string;
  sku: string;
  segment: "LUBRICANTS" | "BATTERIES" | "TIRES";
  name: string;
  brand: string;
  category: string;
  active: boolean;
  referencePhotos: Array<{ id: string; url: string; note: string }>;
};

export function ProductsInlineTable({ initialRows }: { initialRows: ProductRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingPhotoProductId, setUploadingPhotoProductId] = useState<string | null>(null);

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
      showApiErrorToast(toast, error, "Failed to update");
    } finally {
      setSavingId(null);
    }
  }

  async function uploadReferencePhoto(row: ProductRow, file: File) {
    setUploadingPhotoProductId(row.id);
    try {
      const form = new FormData();
      form.append("file", file);
      if (row.name.trim()) form.append("note", row.name.trim());

      const data = await apiFetchJson<{
        ok: true;
        photo: { id: string; url: string; note: string | null };
      }>(`/api/products/${row.id}/reference-photos`, {
        method: "POST",
        body: form,
      });

      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                referencePhotos: [
                  {
                    id: data.photo.id,
                    url: data.photo.url,
                    note: data.photo.note ?? "",
                  },
                  ...item.referencePhotos,
                ],
              }
            : item,
        ),
      );

      toast.success(`Reference image uploaded for ${row.name}`);
    } catch (error) {
      showApiErrorToast(toast, error, "Failed to upload reference image");
    } finally {
      setUploadingPhotoProductId(null);
    }
  }

  async function deleteReferencePhoto(rowId: string, photoId: string) {
    try {
      await apiFetchJson<{ ok: true }>(`/api/products/${rowId}/reference-photos/${photoId}`, {
        method: "DELETE",
      });

      setRows((prev) =>
        prev.map((item) =>
          item.id === rowId
            ? {
                ...item,
                referencePhotos: item.referencePhotos.filter((photo) => photo.id !== photoId),
              }
            : item,
        ),
      );

      toast.success("Reference image removed");
    } catch (error) {
      showApiErrorToast(toast, error, "Failed to delete reference image");
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
            <th className="text-left p-2">Ref Count</th>
            <th className="text-left p-2">Reference Images</th>
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
              <td className="p-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {row.referencePhotos.length}
                </span>
              </td>
              <td className="p-2">
                <div className="space-y-2 min-w-[220px]">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingPhotoProductId === row.id}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void uploadReferencePhoto(row, file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {row.referencePhotos.map((photo) => (
                      <div key={photo.id} className="border rounded p-1.5 space-y-1">
                        <a href={photo.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt={photo.note || row.name} className="h-12 w-12 object-cover rounded" />
                        </a>
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => void deleteReferencePhoto(row.id, photo.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    {!row.referencePhotos.length && (
                      <span className="text-xs text-foreground/60">No refs</span>
                    )}
                  </div>
                </div>
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
              <td className="p-4 text-gray-500" colSpan={9}>
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
