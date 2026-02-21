"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetchJson, showApiErrorToast } from "@/lib/api-client";

const SETTING_GROUPS = [
  {
    label: "Scoring Thresholds",
    keys: [
      { key: "scoring.threshold.good", label: "GOOD threshold (score >= X)", type: "number" },
      { key: "scoring.threshold.bad", label: "BAD threshold (score < X)", type: "number" },
    ],
  },
  {
    label: "Confidence Thresholds",
    keys: [
      { key: "scoring.confidence.good", label: "High confidence (>= X)", type: "number" },
      { key: "scoring.confidence.needsReview", label: "Needs review (< X)", type: "number" },
    ],
  },
  {
    label: "Sub-score Weights",
    keys: [
      { key: "scoring.weights.visibility", label: "Visibility (max points)", type: "number" },
      { key: "scoring.weights.shelfShare", label: "Shelf Share (max points)", type: "number" },
      { key: "scoring.weights.placement", label: "Placement (max points)", type: "number" },
      { key: "scoring.weights.availability", label: "Availability (max points)", type: "number" },
    ],
  },
  {
    label: "Map & Data",
    keys: [
      { key: "map.recencyDays", label: "Recency window (days)", type: "number" },
      { key: "retention.photoMonths", label: "Retention policy (months)", type: "number" },
    ],
  },
];

export function SettingsEditor({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState<string | null>(null);

  async function saveSetting(key: string, value: string) {
    setSaving(key);
    try {
      await apiFetchJson<{ ok: true }>("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      setSettings((prev) => ({ ...prev, [key]: value }));
      toast.success(`Updated ${key}`);
    } catch (err) {
      showApiErrorToast(toast, err, "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {SETTING_GROUPS.map((group) => (
        <div key={group.label} className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm">{group.label}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {group.keys.map(({ key, label, type }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-foreground/70">{label}</label>
                <div className="flex gap-2">
                  <input
                    type={type}
                    step={type === "number" ? "0.01" : undefined}
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    value={settings[key] ?? ""}
                    onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                  <button
                    onClick={() => saveSetting(key, settings[key] ?? "")}
                    disabled={saving === key}
                    className="border rounded px-3 py-2 text-xs hover:bg-foreground/5 disabled:opacity-50 transition-colors"
                  >
                    {saving === key ? "..." : "Save"}
                  </button>
                </div>
                <p className="text-xs opacity-50">key: {key}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Retention cleanup button */}
      <div className="border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold text-sm">Data Retention</h3>
        <p className="text-sm opacity-70">
          Current retention: <b>{settings["retention.photoMonths"] ?? "6"} months</b>.
          Running cleanup will permanently delete evaluations and photos older than this period.
        </p>
        <RetentionCleanup />
      </div>
    </div>
  );
}

function RetentionCleanup() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function runCleanup() {
    if (!confirm("This will permanently delete old data. Continue?")) return;
    setRunning(true);
    try {
      const data = await apiFetchJson<Record<string, unknown>>("/api/admin/retention", { method: "POST" });
      setResult(data);
      toast.success("Retention cleanup complete");
    } catch (err) {
      showApiErrorToast(toast, err, "Cleanup failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={runCleanup}
        disabled={running}
        className="border border-red-300 text-red-700 dark:text-red-400 rounded px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
      >
        {running ? "Running cleanup..." : "Run retention cleanup"}
      </button>
      {result && (
        <div className="text-xs bg-muted rounded p-2">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
