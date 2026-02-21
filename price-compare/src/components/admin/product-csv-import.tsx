"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetchJson, showApiErrorToast } from "@/lib/api-client";

export function ProductCsvImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  async function handleImport() {
    if (!file) {
      toast.error("Select a CSV file first");
      return;
    }

    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await apiFetchJson<{ created: number; updated: number; errors: string[] }>("/api/admin/products/import", {
        method: "POST",
        body: fd,
      });
      setResult(data);
      toast.success(`Imported: ${data.created} created, ${data.updated} updated`);
      router.refresh();
    } catch (err) {
      showApiErrorToast(toast, err, "Import failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-sm">CSV Product Import</h3>
      <p className="text-xs opacity-70">Upload a CSV with columns: <b>name</b> (required), <b>sku</b>, <b>ourPrice</b>. Existing products are updated; new ones are created. Price changes are tracked in version history.</p>
      <div className="flex gap-2 items-center">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          onClick={handleImport}
          disabled={!file || uploading}
          className="border rounded px-4 py-2 text-sm hover:bg-foreground/5 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Importing..." : "Import CSV"}
        </button>
      </div>
      {result && (
        <div className="text-sm space-y-1">
          <p>Created: <b>{result.created}</b> · Updated: <b>{result.updated}</b></p>
          {result.errors.length > 0 && (
            <details className="text-xs text-red-600">
              <summary>{result.errors.length} error(s)</summary>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
