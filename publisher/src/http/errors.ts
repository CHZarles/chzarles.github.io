import type { Context } from "hono";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "FORBIDDEN_ORIGIN"
  | "HEAD_MOVED"
  | "PAYLOAD_TOO_LARGE"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "GITHUB_UPSTREAM"
  | "NOT_FOUND"
  | "INTERNAL";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonError(c: Context, err: HttpError, requestId: string) {
  return c.json(
    {
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      },
    },
    err.status as 400,
    {
      "X-Request-Id": requestId,
    },
  );
}

