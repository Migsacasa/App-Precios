"use client";

import { useState } from "react";
import { toast } from "sonner";

export function RequestIdChip({ requestId }: { requestId: string }) {
  const [copying, setCopying] = useState(false);

  async function copyId() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(requestId);
      toast.success("Request ID copied");
    } catch {
      toast.error("Could not copy request ID");
    } finally {
      setCopying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyId}
      disabled={copying}
      className="inline-flex items-center rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
      title="Copy request ID"
      aria-label="Copy request ID"
    >
      {copying ? "Copying..." : `Request ID: ${requestId}`}
    </button>
  );
}
