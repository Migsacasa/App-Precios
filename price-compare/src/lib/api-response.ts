import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

type ErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

function resolveRequestId(req?: Request): string {
  return req?.headers.get("x-request-id") ?? randomUUID();
}

export function jsonOk<T>(req: Request | undefined, data: T, init?: ResponseInit) {
  const requestId = resolveRequestId(req);
  const response = NextResponse.json(
    {
      ok: true,
      data,
      requestId,
    },
    init,
  );
  response.headers.set("x-request-id", requestId);
  return response;
}

export function jsonError(
  req: Request | undefined,
  error: ErrorPayload,
  status: number,
  init?: ResponseInit,
) {
  const requestId = resolveRequestId(req);
  const response = NextResponse.json(
    {
      ok: false,
      error,
      requestId,
    },
    {
      ...init,
      status,
    },
  );
  response.headers.set("x-request-id", requestId);
  return response;
}

export function withRequestIdHeader(req: Request, headers?: HeadersInit): Headers {
  const requestId = resolveRequestId(req);
  const merged = new Headers(headers);
  merged.set("x-request-id", requestId);
  return merged;
}
