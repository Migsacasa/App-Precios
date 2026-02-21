export class ApiClientError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  details?: unknown;

  constructor(args: {
    message: string;
    status: number;
    code?: string;
    requestId?: string;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "ApiClientError";
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.details = args.details;
  }
}

export type ToastApi = {
  error: (message: string, options?: { action?: { label: string; onClick: () => void } }) => void;
  success: (message: string) => void;
};

function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const requestId = response.headers.get("x-request-id") ?? undefined;

  let json: any = null;
  if (isJsonResponse(response)) {
    json = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const envelopeError = json?.error;
    const message =
      (typeof envelopeError?.message === "string" && envelopeError.message) ||
      (typeof json?.error === "string" && json.error) ||
      response.statusText ||
      "Request failed";

    throw new ApiClientError({
      message,
      status: response.status,
      code: typeof envelopeError?.code === "string" ? envelopeError.code : undefined,
      requestId: typeof json?.requestId === "string" ? json.requestId : requestId,
      details: envelopeError?.details,
    });
  }

  if (json && typeof json === "object" && "ok" in json && "data" in json) {
    return json.data as T;
  }

  return json as T;
}

export function formatApiError(error: unknown, fallback = "Request failed"): string {
  if (error instanceof ApiClientError) {
    const rid = error.requestId ? ` [req: ${error.requestId}]` : "";
    return `${error.message}${rid}`;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

export function showApiErrorToast(toast: ToastApi, error: unknown, fallback = "Request failed") {
  const message = formatApiError(error, fallback);
  if (error instanceof ApiClientError && error.requestId) {
    toast.error(message, {
      action: {
        label: "Copy ID",
        onClick: () => {
          if (!navigator?.clipboard?.writeText) {
            toast.error("Could not copy request ID");
            return;
          }
          void navigator.clipboard
            .writeText(error.requestId!)
            .then(() => toast.success("Request ID copied"))
            .catch(() => toast.error("Could not copy request ID"));
        },
      },
    });
    return;
  }
  toast.error(message);
}
