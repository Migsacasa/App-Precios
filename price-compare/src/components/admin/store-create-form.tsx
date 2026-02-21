"use client";

import { useState } from "react";
import { toast } from "sonner";

export function StoreCreateForm() {
  const [customerCode, setCustomerCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [zone, setZone] = useState("");
  const [route, setRoute] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);

  async function onCreate() {
    setSaving(true);
    try {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerCode,
          name,
          city,
          zone,
          route,
          lat: Number(lat),
          lng: Number(lng),
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast.success("Store created");
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Create failed";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border rounded p-4 space-y-2">
      <h3 className="font-semibold">Add store manually</h3>
      <div className="grid md:grid-cols-3 gap-2">
        <input className="border rounded px-2 py-2" placeholder="Customer Code" value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="Store Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="Zone" value={zone} onChange={(e) => setZone(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="Route" value={route} onChange={(e) => setRoute(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
      </div>
      <button className="border rounded px-3 py-2" type="button" onClick={onCreate} disabled={saving}>
        {saving ? "Saving..." : "Create store"}
      </button>
    </div>
  );
}
