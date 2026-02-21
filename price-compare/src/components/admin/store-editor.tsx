"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetchJson, formatApiError } from "@/lib/api-client";

const StoreMapPicker = dynamic(
  () => import("@/components/admin/store-map-picker").then((m) => m.StoreMapPicker),
  { ssr: false }
);

type StoreOption = {
  id: string;
  customerCode: string;
  name: string;
  chain: string;
  city: string;
  zone: string;
  route: string;
  lat: number;
  lng: number;
  active: boolean;
};

export function StoreEditor({ stores }: { stores: StoreOption[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(stores[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((store) =>
      `${store.customerCode} ${store.name} ${store.city} ${store.chain}`.toLowerCase().includes(q)
    );
  }, [stores, query]);

  const selected = useMemo(
    () => stores.find((store) => store.id === selectedId) ?? stores[0],
    [stores, selectedId]
  );

  const [form, setForm] = useState<StoreOption | undefined>(selected);

  if (!selected || !form) {
    return <div className="border rounded p-4 text-sm opacity-80">No stores available.</div>;
  }

  async function save() {
    if (!form) return;

    setSaving(true);
    try {
      await apiFetchJson<{ ok: true }>(`/api/stores/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerCode: form.customerCode,
          name: form.name,
          chain: form.chain,
          city: form.city,
          zone: form.zone,
          route: form.route,
          lat: form.lat,
          lng: form.lng,
          active: form.active,
        }),
      });

      toast.success("Store updated");
    } catch (error) {
      toast.error(formatApiError(error, "Failed to update store"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4">
      <div className="space-y-2">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Search store"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="border rounded max-h-[520px] overflow-auto">
          {filtered.map((store) => (
            <button
              key={store.id}
              className={`w-full text-left p-3 border-b last:border-b-0 ${store.id === form.id ? "bg-white/10" : ""}`}
              onClick={() => {
                setSelectedId(store.id);
                setForm(store);
              }}
            >
              <p className="text-sm font-medium">{store.customerCode} · {store.name}</p>
              <p className="text-xs opacity-80">
                {store.city || "No city"}
              </p>
            </button>
          ))}
          {!filtered.length && <p className="p-3 text-sm opacity-80">No stores match search.</p>}
        </div>
      </div>

      <div className="space-y-3 border rounded p-4">
        <h2 className="font-semibold">Store editor</h2>
        <div className="grid md:grid-cols-2 gap-2">
          <input
            className="border rounded px-3 py-2"
            value={form.customerCode}
            onChange={(event) => setForm({ ...form, customerCode: event.target.value })}
            placeholder="Customer Code"
          />
          <input
            className="border rounded px-3 py-2"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Store Name"
          />
          <input
            className="border rounded px-3 py-2"
            value={form.chain}
            onChange={(event) => setForm({ ...form, chain: event.target.value })}
            placeholder="Chain"
          />
          <input
            className="border rounded px-3 py-2"
            value={form.city}
            onChange={(event) => setForm({ ...form, city: event.target.value })}
            placeholder="City"
          />
          <input
            className="border rounded px-3 py-2"
            value={form.zone}
            onChange={(event) => setForm({ ...form, zone: event.target.value })}
            placeholder="Zone"
          />
          <input
            className="border rounded px-3 py-2"
            value={form.route}
            onChange={(event) => setForm({ ...form, route: event.target.value })}
            placeholder="Route"
          />
          <input
            className="border rounded px-3 py-2"
            value={form.lat}
            onChange={(event) => setForm({ ...form, lat: Number(event.target.value) || 0 })}
            placeholder="Latitude"
          />
          <input
            className="border rounded px-3 py-2"
            value={form.lng}
            onChange={(event) => setForm({ ...form, lng: Number(event.target.value) || 0 })}
            placeholder="Longitude"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm({ ...form, active: event.target.checked })}
          />
          Active store
        </label>

        <div className="rounded overflow-hidden border">
          <StoreMapPicker
            lat={form.lat || 12.13}
            lng={form.lng || -86.25}
            onChange={(lat, lng) => setForm((prev) => (prev ? { ...prev, lat, lng } : prev))}
          />
        </div>

        <button className="border rounded px-4 py-2" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save store"}
        </button>
      </div>
    </div>
  );
}
