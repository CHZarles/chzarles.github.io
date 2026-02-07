import { HttpError } from "../http/errors";

type FetchError = { message?: string; name?: string; remote?: boolean; retryable?: boolean };

function isRetryableNetworkError(err: unknown): boolean {
  const e = err as FetchError | null;
  if (!e) return false;
  if (e.name === "AbortError") return true;
  if (e.retryable === true) return true;
  return false;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exchangeCodeForAccessToken(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<string> {
  const timeoutMs = args.timeoutMs ?? 45_000;
  const maxAttempts = args.maxAttempts ?? 3;

  let lastNetworkErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "hyperblog-publisher",
        },
        body: new URLSearchParams({
          client_id: args.clientId,
          client_secret: args.clientSecret,
          code: args.code,
          redirect_uri: args.redirectUri,
        }),
        signal: ctrl.signal,
      });
    } catch (err) {
      lastNetworkErr = err;
      if (attempt < maxAttempts && isRetryableNetworkError(err)) {
        clearTimeout(timeoutId);
        await sleepMs(150 * attempt);
        continue;
      }

      const e = err as FetchError | null;
      throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub OAuth exchange failed.", {
        reason: e?.message ?? String(err),
        name: e?.name,
        remote: e?.remote,
        retryable: e?.retryable,
        attempt,
        maxAttempts,
        timeoutMs,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data = (await res.json().catch(() => null)) as
      | { access_token?: string; token_type?: string; scope?: string; error?: string; error_description?: string }
      | null;

    // Non-network errors are not retryable (invalid/expired code, bad client secret, etc.)
    if (!res.ok || !data?.access_token) {
      throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub OAuth exchange failed.", {
        githubStatus: res.status,
        githubError: data?.error,
        githubMessage: data?.error_description,
        attempt,
        maxAttempts,
        timeoutMs,
      });
    }

    return data.access_token;
  }

  const e = lastNetworkErr as FetchError | null;
  throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub OAuth exchange failed.", {
    reason: e?.message ?? String(lastNetworkErr),
    name: e?.name,
    remote: e?.remote,
    retryable: e?.retryable,
    maxAttempts,
    timeoutMs,
  });
}

export async function githubAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
}): Promise<string> {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("scope", args.scope);
  url.searchParams.set("state", args.state);
  return url.toString();
}
