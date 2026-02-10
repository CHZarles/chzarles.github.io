import type { PublisherError } from "../../ui/publisher/client";

export function formatStudioError(err: unknown): { message: string; code?: string } {
  const pub = (err as any)?.publisher as PublisherError | undefined;
  if (pub && typeof pub.code === "string" && typeof pub.message === "string") {
    if (pub.code === "HEAD_MOVED") {
      const exp = (pub.details as any)?.expectedHeadSha;
      const act = (pub.details as any)?.actualHeadSha;
      const extra =
        typeof exp === "string" && typeof act === "string" && exp && act
          ? ` (expected ${exp.slice(0, 7)}, got ${act.slice(0, 7)})`
          : "";
      return { code: pub.code, message: `${pub.code}: ${pub.message}${extra}` };
    }

    if (pub.code === "RATE_LIMITED") {
      const ra = (pub.details as any)?.retryAfterSeconds;
      const extra = typeof ra === "number" && Number.isFinite(ra) && ra > 0 ? ` (retry after ${ra}s)` : "";
      return { code: pub.code, message: `${pub.code}: ${pub.message}${extra}` };
    }

    if (pub.code === "GITHUB_UPSTREAM") {
      const status = (pub.details as any)?.githubStatus;
      const path = (pub.details as any)?.path;
      const ra = (pub.details as any)?.retryAfterSeconds;
      const bits: string[] = [];
      if (typeof status === "number") bits.push(`github:${status}`);
      if (typeof path === "string" && path) bits.push(`api:${path}`);
      if (typeof ra === "number" && Number.isFinite(ra) && ra > 0) bits.push(`retry:${ra}s`);
      const extra = bits.length ? ` (${bits.join(" · ")})` : "";
      return { code: pub.code, message: `${pub.code}: ${pub.message}${extra}` };
    }

    return { message: `${pub.code}: ${pub.message}`, code: pub.code };
  }

  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}
