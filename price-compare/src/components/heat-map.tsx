"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

type HeatPoint = {
  storeId: string;
  customerCode: string;
  customerName: string;
  lat: number;
  lng: number;
  city: string | null;
  zone?: string | null;
  rating: "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW" | "NO_IMAGE";
  color: "green" | "yellow" | "red" | "orange" | "black";
  isStale?: boolean;
  score?: number | null;
  confidence?: number | null;
  lastEvaluationAt: string | null;
  summary?: string | null;
  whyBullets?: string[];
  evidence?: Array<{ type: string; detail: string; severity: string }>;
  recommendations?: Array<{ action: string; why: string; expectedImpact: string; priority: string }>;
  segmentInputs?: Array<{ segment: string; slot: number; priceIndex: number }>;
  photoUrls?: string[];
  overrideRating?: string | null;
};

function markerColor(color: HeatPoint["color"]) {
  if (color === "green") return "#16a34a";
  if (color === "yellow") return "#eab308";
  if (color === "red") return "#dc2626";
  if (color === "orange") return "#ea580c";
  return "#111827";
}

function ratingBadge(rating: string) {
  const map: Record<string, string> = {
    GOOD: "bg-green-100 text-green-800",
    REGULAR: "bg-yellow-100 text-yellow-800",
    BAD: "bg-red-100 text-red-800",
    NEEDS_REVIEW: "bg-orange-100 text-orange-800",
  };
  return map[rating] ?? "bg-gray-100 text-gray-800";
}

export function HeatMap({ points }: { points: HeatPoint[] }) {
  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : [12.13, -86.25];
  const [selected, setSelected] = useState<HeatPoint | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs px-3 py-2">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-600" />GOOD</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-yellow-500" />REGULAR</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-600" />BAD</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-orange-600" />NEEDS REVIEW</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-gray-900" />STALE / NO DATA</span>
      </div>

      <div className="relative">
        <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%", minHeight: 400 }} className="h-[60vh] md:h-[560px]">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {points.map((point) => (
            <CircleMarker
              key={point.storeId}
              center={[point.lat, point.lng]}
              radius={9}
              pathOptions={{
                color: markerColor(point.color),
                fillColor: markerColor(point.color),
                fillOpacity: point.isStale ? 0.5 : 0.9,
                weight: point.isStale ? 1 : 2,
                dashArray: point.isStale ? "4 4" : undefined,
              }}
              eventHandlers={{
                click: () => setSelected(point),
              }}
            >
              <Popup>
                <div className="space-y-1 text-xs">
                  <p><b>{point.customerCode}</b></p>
                  <p>{point.customerName}</p>
                  {point.city && <p>{point.city}</p>}
                  <p>Rating: {point.rating}{point.isStale ? " (stale)" : ""}</p>
                  {point.score != null && <p>Score: {point.score}/100</p>}
                  <p>Latest: {point.lastEvaluationAt ? point.lastEvaluationAt.slice(0, 10) : "-"}</p>
                  <button
                    className="underline text-blue-600"
                    onClick={(e) => { e.stopPropagation(); setSelected(point); }}
                  >
                    View details
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Drilldown Drawer */}
        {selected && (
          <div className="absolute top-0 right-0 h-full w-80 max-w-full bg-background border-l shadow-xl z-[1000] overflow-y-auto">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{selected.customerCode}</h3>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs border rounded px-2 py-1 hover:bg-foreground/5"
                >
                  Close
                </button>
              </div>

              <p className="text-sm font-medium">{selected.customerName}</p>
              {selected.city && <p className="text-xs opacity-70">{selected.city}{selected.zone ? ` · Zone: ${selected.zone}` : ""}</p>}

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ratingBadge(selected.rating)}`}>
                  {selected.rating}
                </span>
                {selected.overrideRating && (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ratingBadge(selected.overrideRating)}`}>
                    Override: {selected.overrideRating}
                  </span>
                )}
                {selected.isStale && <span className="text-xs text-orange-600">STALE</span>}
              </div>

              {selected.score != null && (
                <p className="text-sm">Score: <b>{selected.score}</b>/100 · Confidence: {selected.confidence != null ? `${(selected.confidence * 100).toFixed(0)}%` : "—"}</p>
              )}

              {selected.summary && <p className="text-sm">{selected.summary}</p>}

              {/* Photos */}
              {selected.photoUrls && selected.photoUrls.length > 0 && (
                <div className="flex gap-1 overflow-x-auto">
                  {selected.photoUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Photo ${i + 1}`} className="h-16 rounded border object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {/* Why bullets */}
              {selected.whyBullets && selected.whyBullets.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-1">Why</h4>
                  <ul className="list-disc pl-4 text-xs space-y-0.5">
                    {selected.whyBullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}

              {/* Evidence */}
              {selected.evidence && selected.evidence.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-1">Evidence</h4>
                  <div className="space-y-1">
                    {selected.evidence.map((e, i) => (
                      <div key={i} className="text-xs flex gap-1.5">
                        <span className={`px-1 py-0.5 rounded font-medium shrink-0 ${
                          e.severity === "high" ? "bg-red-100 text-red-700" :
                          e.severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {e.type}
                        </span>
                        <span>{e.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {selected.recommendations && selected.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-1">Recommendations</h4>
                  <div className="space-y-1">
                    {selected.recommendations.map((r, i) => (
                      <p key={i} className="text-xs">
                        <span className={`px-1 py-0.5 rounded font-medium ${
                          r.priority === "high" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                        }`}>{r.priority}</span>{" "}
                        {r.action}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Segment Price Indexes */}
              {selected.segmentInputs && selected.segmentInputs.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-1">Segment Indexes</h4>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {selected.segmentInputs.map((s, i) => (
                      <div key={i} className="border rounded p-1.5">
                        <span className="opacity-70">{s.segment} #{s.slot}</span>
                        <span className="font-medium ml-1">{s.priceIndex.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs opacity-60">
                Last evaluated: {selected.lastEvaluationAt ? selected.lastEvaluationAt.slice(0, 10) : "Never"}
              </p>

              <a
                href={`/dashboard/stores/${selected.storeId}`}
                className="block text-center text-sm border rounded px-3 py-2 hover:bg-foreground/5 transition-colors"
              >
                Full store detail
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
