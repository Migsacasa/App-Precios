"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetchJson, formatApiError } from "@/lib/api-client";

export function StoreCsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onImport() {
    if (!file) {
      toast.error("Select a CSV file first");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const data = await apiFetchJson<{ created: number; updated: number; total: number }>("/api/stores/import", {
        method: "POST",
        body: form,
      });
      toast.success(`Imported ${data.total} stores (${data.created} created / ${data.updated} updated)`);
      window.location.reload();
    } catch (error) {
      toast.error(formatApiError(error, "Import failed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <h3 className="font-semibold">CSV Import</h3>
      <p className="text-sm opacity-80">Required columns: customerCode, name, lat, lng</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button className="border rounded px-3 py-2" type="button" onClick={onImport} disabled={uploading}>
          {uploading ? "Importing..." : "Import CSV"}
        </button>
        <a className="underline text-sm" href="/api/stores/import">
          Download sample CSV
        </a>
      </div>
    </div>
  );
}
