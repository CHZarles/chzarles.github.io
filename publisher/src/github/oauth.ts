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

export type GitHubDeviceCode = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
};

export async function requestDeviceCode(args: {
  clientId: string;
  scope: string;
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<GitHubDeviceCode> {
  const timeoutMs = args.timeoutMs ?? 20_000;
  const maxAttempts = args.maxAttempts ?? 3;

  let lastNetworkErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "hyperblog-publisher",
        },
        body: new URLSearchParams({
          client_id: args.clientId,
          scope: args.scope,
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
      throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub device flow start failed.", {
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
      | {
          device_code?: string;
          user_code?: string;
          verification_uri?: string;
          verification_uri_complete?: string;
          expires_in?: number;
          interval?: number;
          error?: string;
          error_description?: string;
        }
      | null;

    if (!res.ok || !data?.device_code || !data.user_code || !data.verification_uri) {
      throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub device flow start failed.", {
        githubStatus: res.status,
        githubError: data?.error,
        githubMessage: data?.error_description,
        attempt,
        maxAttempts,
        timeoutMs,
      });
    }

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete: typeof data.verification_uri_complete === "string" ? data.verification_uri_complete : undefined,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : 900,
      interval: typeof data.interval === "number" ? data.interval : 5,
    };
  }

  const e = lastNetworkErr as FetchError | null;
  throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub device flow start failed.", {
    reason: e?.message ?? String(lastNetworkErr),
    name: e?.name,
    remote: e?.remote,
    retryable: e?.retryable,
    maxAttempts,
    timeoutMs,
  });
}

export type GitHubDevicePoll =
  | { status: "pending"; error: "authorization_pending" | "slow_down" }
  | { status: "success"; accessToken: string; scope?: string }
  | { status: "error"; error: string; message?: string };

export async function exchangeDeviceCodeForAccessTokenOnce(args: {
  clientId: string;
  clientSecret?: string;
  deviceCode: string;
  timeoutMs?: number;
}): Promise<GitHubDevicePoll> {
  const timeoutMs = args.timeoutMs ?? 25_000;
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const params = new URLSearchParams({
      client_id: args.clientId,
      device_code: args.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    if (args.clientSecret) params.set("client_secret", args.clientSecret);

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "hyperblog-publisher",
      },
      body: params,
      signal: ctrl.signal,
    });

    const data = (await res.json().catch(() => null)) as
      | { access_token?: string; token_type?: string; scope?: string; error?: string; error_description?: string }
      | null;

    if (data?.access_token && res.ok) return { status: "success", accessToken: data.access_token, scope: data.scope };

    const err = data?.error ?? (res.ok ? "unknown_error" : `http_${res.status}`);
    if (err === "authorization_pending" || err === "slow_down") return { status: "pending", error: err };

    return { status: "error", error: err, message: data?.error_description };
  } catch (err) {
    const e = err as FetchError | null;
    if (isRetryableNetworkError(err)) {
      return { status: "error", error: "network_error", message: e?.message ?? String(err) };
    }
    throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub device flow poll failed.", {
      reason: e?.message ?? String(err),
      name: e?.name,
      remote: e?.remote,
      retryable: e?.retryable,
      timeoutMs,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
