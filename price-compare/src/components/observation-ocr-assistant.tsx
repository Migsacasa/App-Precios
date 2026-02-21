"use client";

import { useState } from "react";
import { OcrButton } from "@/components/ocr-button";

type Props = {
  onPriceDetected: (price: number) => void;
  onSourceChanged?: (source: string) => void;
  onOcrTextChanged?: (text: string) => void;
  photoLabel: string;
  helperText: string;
};

export function ObservationOcrAssistant({
  onPriceDetected,
  onSourceChanged,
  onOcrTextChanged,
  photoLabel,
  helperText,
}: Props) {
  const [file, setFile] = useState<File | null>(null);

  function handleDetected(price: number, ocrText: string) {
    onPriceDetected(price);
    onSourceChanged?.("OCR");
    onOcrTextChanged?.(ocrText);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm">{photoLabel}</label>
      <input
        type="file"
        accept="image/*"
        className="w-full"
        onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
      />
      <OcrButton file={file} onDetected={handleDetected} />
      <p className="text-xs text-foreground/50">{helperText}</p>
    </div>
  );
}
