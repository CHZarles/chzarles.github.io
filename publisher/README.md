# Publisher API (Mode B)

Cloudflare Workers backend for publishing content to a public GitHub repo (write `main`), with GitHub OAuth + Bearer token.

## Local dev

1. Create a GitHub OAuth App
   - Callback URL: `http://localhost:8787/api/auth/github/callback`

2. Create `publisher/.dev.vars`

```bash
BASE_URL=http://localhost:8787
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
TOKEN_SECRET=...               # random string; used for state+token crypto
TOKEN_TTL_SECONDS=43200
ADMIN_GITHUB_LOGINS=charles
CONTENT_REPO=charles/charles.github.io
CONTENT_BRANCH=main
ALLOWED_ORIGINS=http://localhost:5173,https://<user>.github.io
```

3. Run

```bash
npx wrangler dev --config publisher/wrangler.toml
```

## Production deploy (sketch)

```bash
npx wrangler deploy --config publisher/wrangler.toml
```

