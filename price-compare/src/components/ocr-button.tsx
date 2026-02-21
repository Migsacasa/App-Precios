"use client";

import { useState } from "react";
import { apiFetchJson } from "@/lib/api-client";
import { parsePriceFromText } from "@/lib/ocr";

export function OcrButton({
  file,
  onDetected,
}: {
  file: File | null;
  onDetected: (price: number, ocrText: string, source: "OCR") => void;
}) {
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  async function runOcr() {
    if (!file) return;
    setStatus("running");
    setMsg("Processing…");

    try {
      const fd = new FormData();
      fd.append("photo", file);

      const json = await apiFetchJson<{ text: string }>("/api/ocr", { method: "POST", body: fd });
      const ocrText = String(json.text || "");
      const price = parsePriceFromText(ocrText);
      if (price != null) {
        onDetected(price, ocrText, "OCR");
        setStatus("idle");
        setMsg("OCR detected a price.");
        return;
      }
      setMsg("OCR ran but couldn’t confidently detect a price. Try manual edit.");
    } catch {
      setMsg("Server OCR unavailable. Falling back to client OCR.");
    }

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const result = await Tesseract.recognize(file, "eng+spa");
      const ocrText = result.data.text || "";
      const price = parsePriceFromText(ocrText);

      if (price == null) {
        setStatus("error");
        setMsg("No price found in OCR text. Please enter manually.");
        return;
      }

      onDetected(price, ocrText, "OCR");
      setStatus("idle");
      setMsg("OCR detected a price.");
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message ? error.message : "unknown error";
      setStatus("error");
      setMsg(`OCR failed: ${message}`);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={runOcr}
        disabled={!file || status === "running"}
        className="border rounded px-3 py-2"
      >
        {status === "running" ? "Running OCR…" : "Run OCR from photo"}
      </button>
      {msg && <p className="text-xs text-gray-600">{msg}</p>}
    </div>
  );
}
