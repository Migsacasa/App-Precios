import Tesseract from "tesseract.js";

export async function extractTextFromImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const result = await Tesseract.recognize(url, "eng");
    return result.data.text ?? "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function guessPrice(text: string): number | null {
  const cleaned = text.replace(/[,]/g, ".");
  const matches = cleaned.match(/\b(\d{1,5}(?:\.\d{2})?)\b/g);
  if (!matches?.length) return null;

  const nums = matches.map(Number).filter((n) => n > 0 && n < 100000);
  if (!nums.length) return null;

  return Math.max(...nums);
}

export function parsePriceFromText(raw: string): number | null {
  const text = raw.replace(/\s+/g, " ");

  const matches = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2})|\d+)/g);
  if (!matches?.length) return null;

  const candidates = matches
    .map((s) => s.trim())
    .map((s) => {
      const hasDot = s.includes(".");
      const hasComma = s.includes(",");
      let normalized = s;

      if (hasDot && hasComma) {
        const lastDot = s.lastIndexOf(".");
        const lastComma = s.lastIndexOf(",");
        const decSep = lastDot > lastComma ? "." : ",";
        const thouSep = decSep === "." ? "," : ".";

        normalized = s.split(thouSep).join("");
        normalized = normalized.replace(decSep, ".");
      } else if (hasComma && !hasDot) {
        normalized = s.replace(",", ".");
      } else {
        normalized = s;
      }

      const value = Number(normalized);
      if (!Number.isFinite(value)) return null;
      return value;
    })
    .filter((value): value is number => value !== null);

  if (!candidates.length) return null;

  const plausible = candidates.filter((num) => num > 1 && num < 1_000_000);
  if (!plausible.length) return candidates[0];

  return plausible.sort((a, b) => b - a)[0];
}
