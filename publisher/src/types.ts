export type Bindings = {
  BASE_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  TOKEN_SECRET?: string;
  TOKEN_TTL_SECONDS?: string;
  ADMIN_GITHUB_LOGINS?: string;
  CONTENT_REPO?: string; // "owner/name"
  CONTENT_BRANCH?: string; // default "main"
  CONTENT_ROOT?: string; // default ""
  ALLOWED_ORIGINS?: string; // csv of origins
};

export type AuthUser = {
  id: number;
  login: string;
  avatarUrl?: string;
  ghToken: string;
  iat: number;
  exp: number;
};

