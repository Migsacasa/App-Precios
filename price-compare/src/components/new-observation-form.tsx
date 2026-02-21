"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetchJson, showApiErrorToast } from "@/lib/api-client";
import { countPending, enqueueObservation, syncPending } from "@/lib/offline-db";
import { checkImageQuality, compressImage, type ImageQualityReport } from "@/lib/image-quality";
import { toast } from "sonner";

type Store = {
  id: string;
  customerCode: string;
  name: string;
  city?: string | null;
  lat: number;
  lng: number;
};

type ProductRef = {
  id: string;
  segment: "LUBRICANTS" | "BATTERIES" | "TIRES";
  name: string;
  brand?: string | null;
  category?: string | null;
};

type Analysis = {
  rating: string;
  score: number;
  confidence: number;
  summary: string;
  whyBullets: string[];
  subScores?: { visibility: number; shelfShare: number; placement: number; availability: number };
  evidence?: Array<{ type: string; detail: string; severity: string }>;
  recommendations?: Array<{ priority: string; action: string; rationale?: string }>;
};

type PhotoSlot = {
  label: string;
  type: "WIDE_SHOT" | "SHELF_CLOSEUP" | "OTHER";
  file: File | null;
  quality: ImageQualityReport | null;
  compressed: Blob | null;
};

function numberInputProps(value: string, onChange: (next: string) => void) {
  return {
    type: "number",
    step: "0.01",
    min: "0",
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    className: "w-full border rounded px-3 py-3",
  };
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ratingBadge(rating: string) {
  const map: Record<string, string> = {
    GOOD: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    REGULAR: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    BAD: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    NEEDS_REVIEW: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  };
  return map[rating] ?? "bg-gray-100 text-gray-800";
}

export function NewObservationForm({
  initialStores,
  productRefs,
}: {
  initialStores: Store[];
  productRefs: ProductRef[];
}) {
  const router = useRouter();

  const [stores] = useState(initialStores);
  const [query, setQuery] = useState("");
  const [storeId, setStoreId] = useState("");
  const [sortByDistance, setSortByDistance] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Multi-photo slots (1 required, 2 optional)
  const [photos, setPhotos] = useState<PhotoSlot[]>([
    { label: "Wide shot (full store front)", type: "WIDE_SHOT", file: null, quality: null, compressed: null },
    { label: "Shelf close-up (our products)", type: "SHELF_CLOSEUP", file: null, quality: null, compressed: null },
    { label: "Other (optional)", type: "OTHER", file: null, quality: null, compressed: null },
  ]);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const PRICE_KEYS = ["lubricants1", "lubricants2", "lubricants3", "lubricants4", "batteries1", "batteries2", "tires1"] as const;
  type PriceKey = (typeof PRICE_KEYS)[number];

  // Segment price inputs: competitor price + our price → auto-calc index
  type SlotPrices = { competitorPrice: string; ourPrice: string; manualIndex: string; isManual: boolean };
  const [slotPrices, setSlotPrices] = useState<Record<PriceKey, SlotPrices>>(() => {
    const init: Record<string, SlotPrices> = {};
    for (const key of PRICE_KEYS) init[key] = { competitorPrice: "", ourPrice: "", manualIndex: "", isManual: false };
    return init as Record<PriceKey, SlotPrices>;
  });

  const updateSlotPrice = (key: PriceKey, field: keyof SlotPrices, value: string | boolean) =>
    setSlotPrices((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const calcIndex = (slot: SlotPrices): string => {
    if (slot.isManual) return slot.manualIndex;
    const comp = parseFloat(slot.competitorPrice);
    const our = parseFloat(slot.ourPrice);
    if (comp > 0 && our > 0) return (comp / our).toFixed(2);
    return "";
  };

  const [notes, setNotes] = useState("");
  const [gpsAtCaptureLat, setGpsAtCaptureLat] = useState("");
  const [gpsAtCaptureLng, setGpsAtCaptureLng] = useState("");
  const [capturingGps, setCapturingGps] = useState(false);

  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // GPS-based sorting
  const filteredStores = useMemo(() => {
    let list = stores;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((store) =>
        `${store.customerCode} ${store.name} ${store.city ?? ""}`.toLowerCase().includes(q),
      );
    }
    if (sortByDistance && userLat !== null && userLng !== null) {
      list = [...list].sort(
        (a, b) => haversineDistance(userLat, userLng, a.lat, a.lng) - haversineDistance(userLat, userLng, b.lat, b.lng),
      );
    }
    return list;
  }, [stores, query, sortByDistance, userLat, userLng]);

  const refsBySegment = useMemo(
    () => ({
      LUBRICANTS: productRefs.filter((item) => item.segment === "LUBRICANTS"),
      BATTERIES: productRefs.filter((item) => item.segment === "BATTERIES"),
      TIRES: productRefs.filter((item) => item.segment === "TIRES"),
    }),
    [productRefs],
  );

  useEffect(() => {
    setOnline(navigator.onLine);
    void countPending().then(setPending);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Auto-capture GPS for "near me" sort and capture location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setGpsAtCaptureLat(String(pos.coords.latitude));
          setGpsAtCaptureLng(String(pos.coords.longitude));
        },
        () => { /* silent fallback */ },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, []);

  const handlePhotoChange = useCallback(async (index: number, file: File | null) => {
    if (!file) {
      setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, file: null, quality: null, compressed: null } : p)));
      return;
    }
    // Run quality check and compression in parallel
    const [quality, compressed] = await Promise.all([
      checkImageQuality(file),
      compressImage(file),
    ]);
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, file, quality, compressed } : p)),
    );
    if (!quality.ok) {
      toast.warning(`Photo ${index + 1}: ${quality.issues.map((i) => i.message).join("; ")}`);
    }
  }, []);

  function captureGps() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available");
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsAtCaptureLat(String(position.coords.latitude));
        setGpsAtCaptureLng(String(position.coords.longitude));
        setUserLat(position.coords.latitude);
        setUserLng(position.coords.longitude);
        toast.success("GPS captured");
        setCapturingGps(false);
      },
      (error) => {
        toast.error(error.message);
        setCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function analyzePhoto() {
    const filledPhotos = photos.filter((p) => p.file !== null);
    if (filledPhotos.length === 0) {
      toast.error("At least one store photo is required");
      return;
    }

    if (!navigator.onLine) {
      toast.error("AI analysis needs internet connection");
      return;
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      filledPhotos.forEach((p, idx) => {
        const blob = p.compressed ?? p.file!;
        formData.append(idx === 0 ? "photo" : `photo_${idx}`, blob, `photo_${idx}.jpg`);
        formData.append(idx === 0 ? "photoType" : `photoType_${idx}`, p.type);
      });

      const data = await apiFetchJson<{ photoUrl: string; analysis: Analysis }>("/api/evaluations/analyze", {
        method: "POST",
        body: formData,
      });
      setAnalysis(data.analysis);
      toast.success("AI review complete");
    } catch (error) {
      showApiErrorToast(toast, error, "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function runSyncNow() {
    setSyncing(true);
    try {
      const result = await syncPending();
      setPending(await countPending());
      toast.success(`Synced ${result.synced} queued evaluation(s)`);
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function validateRequiredPriceIndexes() {
    return PRICE_KEYS.every((key) => {
      const idx = calcIndex(slotPrices[key]);
      return idx !== "" && Number(idx) >= 0 && Number.isFinite(Number(idx));
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!storeId) {
      toast.error("Select a store from imported list");
      return;
    }
    const filledPhotos = photos.filter((p) => p.file !== null);
    if (filledPhotos.length === 0) {
      toast.error("At least one store photo is required");
      return;
    }
    if (!validateRequiredPriceIndexes()) {
      toast.error("Complete all Price Index slots (enter Competitor + Our price, or fill Manual Index)");
      return;
    }

    const clientEvaluationId = crypto.randomUUID();
    const formData = new FormData();
    formData.append("storeId", storeId);
    formData.append("clientEvaluationId", clientEvaluationId);

    // Append photos
    filledPhotos.forEach((p, idx) => {
      const blob = p.compressed ?? p.file!;
      formData.append(idx === 0 ? "photo" : `photo_${idx}`, blob, `photo_${idx}.jpg`);
      formData.append(idx === 0 ? "photoType" : `photoType_${idx}`, p.type);
    });

    if (notes.trim()) formData.append("notes", notes.trim());
    if (gpsAtCaptureLat) formData.append("gpsAtCaptureLat", gpsAtCaptureLat);
    if (gpsAtCaptureLng) formData.append("gpsAtCaptureLng", gpsAtCaptureLng);

    if (analysis) {
      formData.append("aiJson", JSON.stringify(analysis));
    }

    // Append price data with competitorPrice/ourPrice for auto-calc
    for (const key of PRICE_KEYS) {
      const slot = slotPrices[key];
      formData.append(key, calcIndex(slot));
      if (slot.competitorPrice) formData.append(`${key}_competitorPrice`, slot.competitorPrice);
      if (slot.ourPrice) formData.append(`${key}_ourPrice`, slot.ourPrice);
      if (slot.isManual) formData.append(`${key}_isManual`, "true");
    }

    if (!navigator.onLine) {
      const fields: Record<string, string> = {};
      formData.forEach((value, key) => {
        if (typeof value === "string") fields[key] = value;
      });

      await enqueueObservation({
        id: clientEvaluationId,
        createdAt: Date.now(),
        fields,
        photo: filledPhotos[0]?.compressed ?? filledPhotos[0]?.file ?? undefined,
      });

      setPending(await countPending());
      toast.info("Saved offline. Evaluation will sync later.");
      router.push("/observations");
      return;
    }

    setSaving(true);
    try {
      await apiFetchJson<{ ok: true; id: string }>("/api/evaluations", { method: "POST", body: formData });

      toast.success("Evaluation saved");
      router.push("/observations");
    } catch (error) {
      showApiErrorToast(toast, error, "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const hasQualityIssues = photos.some((p) => p.quality && !p.quality.ok);

  return (
    <form onSubmit={onSubmit} className="space-y-5 border rounded-xl p-4 md:p-6">
      {/* PII Warning Banner */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 text-sm text-amber-800 dark:text-amber-300">
        <strong>Privacy notice:</strong> Avoid capturing personally identifiable information (faces, license plates, ID cards) in photos. AI analysis may detect and flag PII automatically.
      </div>

      {!online && (
        <div className="rounded border p-3 text-sm flex items-center justify-between gap-2">
          <span>Offline mode · queued: {pending}</span>
          <button type="button" className="border rounded px-3 py-2" onClick={runSyncNow} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      )}

      {/* 1. Store Selection with "Near me" GPS sort */}
      <section className="space-y-2">
        <h2 className="font-semibold">1) Select store</h2>
        <input
          className="w-full border rounded px-3 py-3"
          placeholder="Search by customer code, name, city"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sortByDistance}
            onChange={(e) => setSortByDistance(e.target.checked)}
            disabled={userLat === null}
          />
          Sort by distance (nearest first)
          {userLat === null && <span className="text-xs opacity-60">(GPS unavailable)</span>}
        </label>
        <select className="w-full border rounded px-3 py-3" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
          <option value="">Select store</option>
          {filteredStores.map((store) => {
            const dist = sortByDistance && userLat !== null && userLng !== null
              ? ` — ${haversineDistance(userLat, userLng, store.lat, store.lng).toFixed(1)} km`
              : "";
            return (
              <option key={store.id} value={store.id}>
                {store.customerCode} · {store.name}
                {store.city ? ` (${store.city})` : ""}{dist}
              </option>
            );
          })}
        </select>
      </section>

      {/* 2. Multi-photo capture with quality checks */}
      <section className="space-y-3">
        <h2 className="font-semibold">2) Capture store photos (1-3)</h2>
        <p className="text-sm text-foreground/60">Upload 1 wide shot (required) + optional shelf close-up and other photo.</p>

        {photos.map((slot, idx) => (
          <div key={idx} className="border rounded p-3 space-y-2">
            <label className="block text-sm font-medium">{slot.label} {idx === 0 && <span className="text-red-500">*</span>}</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoChange(idx, e.target.files?.[0] ?? null)}
            />
            {slot.file && (
              <img
                src={URL.createObjectURL(slot.file)}
                alt={`Preview ${idx + 1}`}
                className="max-h-32 rounded border object-cover"
              />
            )}
            {slot.quality && !slot.quality.ok && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 text-xs text-yellow-800 dark:text-yellow-300">
                {slot.quality.issues.map((issue, j) => (
                  <p key={j}>⚠ {issue.message}</p>
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          className="border rounded px-3 py-2 hover:bg-foreground/5 transition-colors disabled:opacity-50"
          onClick={analyzePhoto}
          disabled={analyzing || !photos.some((p) => p.file)}
        >
          {analyzing ? "Analyzing photos..." : "Run AI analysis"}
        </button>

        {hasQualityIssues && (
          <p className="text-xs text-yellow-700 dark:text-yellow-400">Some photos have quality issues. Consider retaking for better AI results.</p>
        )}

        {/* AI Analysis Results */}
        {analysis && (
          <div className="rounded-lg border p-4 space-y-3 text-sm bg-muted/30">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded text-xs font-semibold ${ratingBadge(analysis.rating)}`}>
                {analysis.rating}
              </span>
              <span className="font-semibold">Score: {analysis.score}/100</span>
              <span className="text-xs opacity-70">Confidence: {(analysis.confidence * 100).toFixed(0)}%</span>
            </div>
            <p>{analysis.summary}</p>

            {analysis.subScores && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(analysis.subScores).map(([k, v]) => (
                  <div key={k} className="border rounded p-2 text-center">
                    <p className="text-xs opacity-70 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</p>
                    <p className="font-semibold">{v}/25</p>
                  </div>
                ))}
              </div>
            )}

            {analysis.whyBullets?.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {analysis.whyBullets.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}

            {analysis.evidence && analysis.evidence.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">Evidence ({analysis.evidence.length} items)</summary>
                <ul className="mt-1 space-y-1 pl-3">
                  {analysis.evidence.map((e, i) => (
                    <li key={i}><span className="font-medium">[{e.type}]</span> {e.detail} <span className="opacity-60">({e.severity})</span></li>
                  ))}
                </ul>
              </details>
            )}

            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-xs">Recommendations:</p>
                {analysis.recommendations.map((item, index) => (
                  <p key={index} className="text-xs">
                    <b>{item.priority}:</b> {item.action}{item.rationale ? ` — ${item.rationale}` : ""}
                  </p>
                ))}
              </div>
            )}

            {analysis.confidence < 0.35 && (
              <div className="rounded border border-orange-300 bg-orange-50 dark:bg-orange-900/20 p-2 text-xs text-orange-800 dark:text-orange-300">
                ⚠ Low confidence — a manager should review this evaluation.
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Segment Price Index — auto-calc from competitorPrice / ourPrice */}
      <section className="space-y-2">
        <h2 className="font-semibold">3) Segment Price Indexes</h2>
        <p className="text-xs text-foreground/60">Enter Competitor Price and Our Price — the index is auto-calculated. Toggle &quot;Manual&quot; to enter a direct index value.</p>
        <div className="space-y-3">
          {PRICE_KEYS.map((key) => {
            const slot = slotPrices[key];
            const idxVal = calcIndex(slot);
            const label = key.replace(/(\d+)$/, " #$1").replace(/^(.)/, (c) => c.toUpperCase());
            return (
              <div key={key} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{label}</label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={slot.isManual}
                      onChange={(e) => updateSlotPrice(key, "isManual", e.target.checked)}
                    />
                    Manual index
                  </label>
                </div>
                {slot.isManual ? (
                  <input
                    placeholder="Direct price index"
                    {...numberInputProps(slot.manualIndex, (v) => updateSlotPrice(key, "manualIndex", v))}
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-foreground/60 mb-1">Competitor $</label>
                      <input
                        placeholder="0.00"
                        {...numberInputProps(slot.competitorPrice, (v) => updateSlotPrice(key, "competitorPrice", v))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/60 mb-1">Our $</label>
                      <input
                        placeholder="0.00"
                        {...numberInputProps(slot.ourPrice, (v) => updateSlotPrice(key, "ourPrice", v))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/60 mb-1">Index</label>
                      <div className="w-full border rounded px-3 py-3 bg-muted/50 text-sm">{idxVal || "—"}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {!!productRefs.length && (
        <section className="space-y-2">
          <h2 className="font-semibold">Reference products</h2>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            {[...refsBySegment.LUBRICANTS, ...refsBySegment.BATTERIES, ...refsBySegment.TIRES].slice(0, 8).map((item) => (
              <div key={item.id} className="rounded border p-2">
                <p className="font-medium">{item.name}</p>
                <p className="opacity-80">{item.segment}{item.brand ? ` · ${item.brand}` : ""}</p>
                {item.category && <p className="opacity-80">{item.category}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">4) Notes + GPS</h2>
        <label htmlFor="obs-notes" className="block text-sm text-foreground/70">Additional notes (optional)</label>
        <textarea id="obs-notes" className="w-full border rounded px-3 py-3" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" className="border rounded px-3 py-2 hover:bg-foreground/5 transition-colors" onClick={captureGps} disabled={capturingGps}>
            {capturingGps ? "Capturing GPS…" : "Capture GPS"}
          </button>
          <span className="text-xs opacity-80">{gpsAtCaptureLat && gpsAtCaptureLng ? `${gpsAtCaptureLat}, ${gpsAtCaptureLng}` : "No GPS captured"}</span>
        </div>
      </section>

      <button className="w-full h-12 rounded-lg font-medium bg-foreground text-background disabled:opacity-50 transition-opacity" disabled={saving}>
        {saving ? "Saving..." : "Save evaluation"}
      </button>
    </form>
  );
}
