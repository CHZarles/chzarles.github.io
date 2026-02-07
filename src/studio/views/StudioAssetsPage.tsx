import { Check, Copy, ExternalLink, FileText, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import React from "react";
import { publisherFetchJson, publisherUploadFile } from "../../ui/publisher/client";
import { useStudioState } from "../state/StudioState";

type Asset = {
  path: string; // "public/uploads/..."
  url: string; // "/uploads/..."
  rawUrl: string; // github raw (preview)
  bytes: number | null;
  contentType: string;
  sha: string;
};

type AssetsListResponse = {
  assets: Asset[];
  paging: { after: string | null; nextAfter: string | null };
  truncated: boolean;
};

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let idx = 0;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function StudioAssetsPage() {
  const studio = useStudioState();

  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [paging, setPaging] = React.useState<AssetsListResponse["paging"]>({ after: null, nextAfter: null });
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (opts?: { append?: boolean; query?: string }) => {
      if (!studio.token) return;
      setBusy(true);
      setError(null);
      try {
        const url = new URL("/api/admin/uploads", "http://local");
        const query = (opts?.query ?? q).trim();
        if (query) url.searchParams.set("q", query);
        url.searchParams.set("limit", "80");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const res = await publisherFetchJson<AssetsListResponse>({ path: url.pathname + url.search, token: studio.token });
        setAssets((prev) => (opts?.append ? [...prev, ...res.assets] : res.assets));
        setPaging(res.paging);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [studio.token, q, paging.nextAfter],
  );

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.token]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void load({ query: q, append: false });
    }, 260);
    return () => window.clearTimeout(t);
  }, [q, load]);

  const upload = React.useCallback(
    async (file: File) => {
      if (!studio.token) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherUploadFile({ token: studio.token, file });
        setNotice(`Uploaded: ${res.asset.url}`);
        setCommitUrl(res.commit.url);
        await load({ append: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(`Upload failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [studio.token, load],
  );

  const del = React.useCallback(
    async (asset: Asset) => {
      if (!studio.token) return;
      const ok = window.confirm(`Delete ${asset.url}?`);
      if (!ok) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherFetchJson<{ ok: true; commit: { sha: string; url: string } }>({
          path: "/api/admin/uploads",
          method: "DELETE",
          token: studio.token,
          body: { path: asset.path },
        });
        setNotice("Deleted.");
        setCommitUrl(res.commit.url);
        setAssets((prev) => prev.filter((a) => a.path !== asset.path));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(`Delete failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [studio.token],
  );

  const copyUrl = React.useCallback(async (asset: Asset) => {
    const ok = await copyText(asset.url);
    setNotice(ok ? `Copied URL: ${asset.url}` : "Copy failed.");
    setCommitUrl(null);
  }, []);

  const copyMd = React.useCallback(async (asset: Asset) => {
    const md = `![](${asset.url})`;
    const ok = await copyText(md);
    setNotice(ok ? "Copied Markdown." : "Copy failed.");
    setCommitUrl(null);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">ASSETS</div>
          <div className="mt-1 text-sm text-[hsl(var(--muted))]">Browse files under <code>public/uploads/</code>.</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]">
            <ImagePlus className="h-3.5 w-3.5 opacity-85" />
            Upload
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.currentTarget.value = "";
              }}
              disabled={!studio.token || busy}
            />
          </label>
          <button
            type="button"
            onClick={() => void load({ append: false })}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-3.5 w-3.5 opacity-85" />
            Refresh
          </button>
        </div>
      </div>

      {notice ? (
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 text-[hsl(var(--muted))]">{notice}</div>
            {commitUrl ? (
              <a
                href={commitUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
              >
                View commit <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-4 py-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by path…"
          className="w-full max-w-xl rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]"
        />
        <div className="text-xs text-[hsl(var(--muted))]">{busy ? "Loading…" : `${assets.length} items`}</div>
      </div>

      {error ? (
        <div className="border-b border-[hsl(var(--border))] bg-[color-mix(in_oklab,white_60%,transparent)] px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto bg-[hsl(var(--bg))] p-4">
        {assets.length === 0 && !busy ? (
          <div className="card p-6 text-sm text-[hsl(var(--muted))]">No assets yet. Upload one, or pull your repo locally if you published from another machine.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((a) => {
              const isImage = a.contentType.startsWith("image/");
              return (
                <div key={a.path} className="card overflow-hidden">
                  <div className="relative aspect-[4/3] bg-[hsl(var(--card2))]">
                    {isImage ? (
                      <img
                        src={a.rawUrl}
                        alt={a.url}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--muted))]">
                        <FileText className="h-8 w-8 opacity-60" />
                      </div>
                    )}
                    <a
                      href={a.rawUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[color-mix(in_oklab,hsl(var(--card))_80%,transparent)] p-2 text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card))] hover:text-[hsl(var(--fg))]"
                      title="Open"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  <div className="p-3">
                    <div className="truncate text-xs font-medium tracking-tight">{a.url}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[hsl(var(--muted))]">
                      <span className="truncate">{formatBytes(a.bytes)}</span>
                      <span className="truncate">{a.contentType}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void copyUrl(a)}
                        className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                        title="Copy URL"
                      >
                        <Copy className="h-3.5 w-3.5 opacity-85" />
                        URL
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMd(a)}
                        className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                        title="Copy Markdown"
                      >
                        <Check className="h-3.5 w-3.5 opacity-85" />
                        MD
                      </button>
                      <button
                        type="button"
                        onClick={() => void del(a)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 opacity-85" />
                        Del
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {paging.nextAfter ? (
          <button
            type="button"
            onClick={() => void load({ append: true })}
            disabled={busy}
            className="mt-4 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}

