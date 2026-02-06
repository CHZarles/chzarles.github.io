import { HttpError } from "../http/errors";

export async function exchangeCodeForAccessToken(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: args.clientId,
      client_secret: args.clientSecret,
      code: args.code,
      redirect_uri: args.redirectUri,
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; token_type?: string; scope?: string; error?: string; error_description?: string }
    | null;

  if (!res.ok || !data?.access_token) {
    throw new HttpError(502, "GITHUB_UPSTREAM", "GitHub OAuth exchange failed.", {
      githubStatus: res.status,
      githubError: data?.error,
      githubMessage: data?.error_description,
    });
  }

  return data.access_token;
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

