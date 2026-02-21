"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetchJson, showApiErrorToast } from "@/lib/api-client";

const RATING_OPTIONS = ["GOOD", "REGULAR", "BAD"] as const;

function ratingBadge(rating: string) {
  const map: Record<string, string> = {
    GOOD: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300",
    REGULAR: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300",
    BAD: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300",
  };
  return map[rating] ?? "";
}

export function ManagerOverrideForm({
  evaluationId,
  currentRating,
}: {
  evaluationId: string;
  currentRating: string;
}) {
  const router = useRouter();
  const [newRating, setNewRating] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!newRating) {
      toast.error("Select a new rating");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required for overrides");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetchJson<{ ok: true; id: string }>(`/api/evaluations/${evaluationId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newRating, reason: reason.trim() }),
      });
      toast.success("Override applied");
      router.refresh();
    } catch (err) {
      showApiErrorToast(toast, err, "Override failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleOverride} className="space-y-3">
      <p className="text-sm text-foreground/70">
        AI rated this <span className="font-medium">{currentRating}</span>. Choose a different rating:
      </p>
      <div className="flex gap-2">
        {RATING_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setNewRating(r)}
            className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
              newRating === r ? ratingBadge(r) + " ring-2 ring-offset-1 ring-foreground/20" : "border-foreground/20 opacity-60 hover:opacity-100"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        className="w-full border rounded px-3 py-2 text-sm"
        rows={2}
        placeholder="Reason for override (required)..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        type="submit"
        disabled={!newRating || !reason.trim() || submitting}
        className="border rounded px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Applying..." : "Apply Override"}
      </button>
    </form>
  );
}
