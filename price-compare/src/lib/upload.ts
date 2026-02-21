import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID, createHash } from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ["image/"];

// ── Types ──────────────────────────────────────────────────────

export type UploadedObject = {
  url: string;
  thumbnailUrl?: string;
  redactedUrl?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  sha256?: string;
};

export interface StorageProvider {
  putEvaluationPhoto(args: {
    evaluationId: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<UploadedObject>;
}

// ── Errors ─────────────────────────────────────────────────────

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

// ── Validation ─────────────────────────────────────────────────

function validateFile(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadValidationError(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024} MB.`
    );
  }

  const mime = file.type?.toLowerCase() ?? "";
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    throw new UploadValidationError(
      `Invalid file type "${mime || "unknown"}". Only images are accepted.`
    );
  }
}

// ── Local-disk storage provider ────────────────────────────────

class LocalDiskStorage implements StorageProvider {
  private uploadDir: string;
  private publicPrefix: string;

  constructor(uploadDir?: string, publicPrefix?: string) {
    this.uploadDir = uploadDir ?? path.join(process.cwd(), "public", "uploads");
    this.publicPrefix = publicPrefix ?? "/uploads";
  }

  async putEvaluationPhoto(args: {
    evaluationId: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<UploadedObject> {
    await mkdir(this.uploadDir, { recursive: true });

    const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${args.evaluationId}-${randomUUID()}-${safeName}`;
    const filepath = path.join(this.uploadDir, filename);

    await writeFile(filepath, args.bytes);

    const sha256 = createHash("sha256").update(args.bytes).digest("hex");

    return {
      url: `${this.publicPrefix}/${filename}`,
      byteSize: args.bytes.length,
      sha256,
    };
  }
}

// ── Singleton provider (swap for S3/R2 via env) ────────────────

function createStorageProvider(): StorageProvider {
  // Future: check process.env.STORAGE_PROVIDER for "s3" | "r2" | "gcs" etc.
  return new LocalDiskStorage();
}

export const storage: StorageProvider = createStorageProvider();

// ── Legacy helper (delegates to storage provider) ──────────────

export async function saveUpload(file: File, evaluationId?: string): Promise<string> {
  validateFile(file);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await storage.putEvaluationPhoto({
    evaluationId: evaluationId ?? "unlinked",
    fileName: file.name,
    contentType: file.type || "image/jpeg",
    bytes,
  });

  return result.url;
}