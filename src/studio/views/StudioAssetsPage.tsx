import { ArrowUpRight, Check, Copy, ExternalLink, FileText, ImagePlus, RefreshCw, Trash2, X } from "lucide-react";
import React from "react";
import { publisherFetchJson } from "../../ui/publisher/client";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import { useStudioState } from "../state/StudioState";
import { pruneStudioDataCache, readStudioDataCache, stableCacheKeySegment, studioDataCacheKey, writeStudioDataCache } from "../util/cache";
import { formatStudioError } from "../util/errors";

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

type AssetsListCacheV1 = {
  assets: Asset[];
  paging: AssetsListResponse["paging"];
  truncated: boolean;
};

const ASSETS_LIST_CACHE_PREFIX = `${studioDataCacheKey(PUBLISHER_BASE_URL, ["assets", "list"])}:`;
const MAX_ASSETS_LIST_CACHES = 6;

function assetsListCacheKey(query: string): string {
  return studioDataCacheKey(PUBLISHER_BASE_URL, ["assets", "list", stableCacheKeySegment(query)]);
}

type CommitResponse = {
  commit: { sha: string; url: string; headSha?: string };
};

type StagedUpload = {
  name: string;
  path: string; // "public/uploads/..."
  url: string; // "/uploads/..."
  bytes: number;
  contentType: string;
  contentBase64: string;
  previewUrl: string | null;
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

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed."));
    reader.onload = () => {
      const result = reader.result;
      const dataUrl = typeof result === "string" ? result : "";
      const idx = dataUrl.indexOf("base64,");
      if (idx === -1) return reject(new Error("Unexpected file encoding."));
      resolve(dataUrl.slice(idx + "base64,".length));
    };
    reader.readAsDataURL(file);
  });
}

function buildUploadName(file: File): string {
  const name = (file.name ?? "asset").trim();
  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";
  const base = name.replace(/\.[^/.]+$/, "");
  const safeBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "asset";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(16).slice(2, 8);
  const safeExt = ext ? ext.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8) : "";
  return `${stamp}-${safeBase}-${rand}${safeExt ? `.${safeExt}` : ""}`;
}

export function StudioAssetsPage() {
  const studio = useStudioState();

  const [assets, setAssets] = React.useState<Asset[]>(
    () => readStudioDataCache<AssetsListCacheV1>(assetsListCacheKey(""))?.value.assets ?? [],
  );
  const [paging, setPaging] = React.useState<AssetsListResponse["paging"]>(
    () => readStudioDataCache<AssetsListCacheV1>(assetsListCacheKey(""))?.value.paging ?? { after: null, nextAfter: null },
  );
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);

  const [stagedUploads, setStagedUploads] = React.useState<StagedUpload[]>([]);
  const [stagedDeletes, setStagedDeletes] = React.useState<string[]>([]);

  const loadSeqRef = React.useRef(0);
  const load = React.useCallback(
    async (opts?: { append?: boolean; query?: string; background?: boolean }) => {
      if (!studio.token) return;
      const seq = (loadSeqRef.current += 1);
      const background = Boolean(opts?.background);
      if (background) setRefreshing(true);
      else setBusy(true);
      if (!background) setError(null);
      try {
        const url = new URL("/api/admin/uploads", "http://local");
        const query = (opts?.query ?? "").trim();
        if (query) url.searchParams.set("q", query);
        url.searchParams.set("limit", "80");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const res = await publisherFetchJson<AssetsListResponse>({ path: url.pathname + url.search, token: studio.token });
        if (seq !== loadSeqRef.current) return;
        setAssets((prev) => {
          const next = opts?.append ? [...prev, ...res.assets] : res.assets;
          if (!opts?.append) {
            writeStudioDataCache(assetsListCacheKey(query), { assets: next, paging: res.paging, truncated: res.truncated });
            pruneStudioDataCache(ASSETS_LIST_CACHE_PREFIX, MAX_ASSETS_LIST_CACHES);
          }
          return next;
        });
        setPaging(res.paging);
      } catch (err: unknown) {
        if (seq !== loadSeqRef.current) return;
        if (!background) setError(formatStudioError(err).message);
      } finally {
        if (seq !== loadSeqRef.current) return;
        if (background) setRefreshing(false);
        else setBusy(false);
      }
    },
    [studio.token, paging.nextAfter],
  );

  React.useEffect(() => {
    if (!studio.token) return;
    const query = q.trim();
    const cached = readStudioDataCache<AssetsListCacheV1>(assetsListCacheKey(query))?.value ?? null;
    if (cached) {
      setAssets(cached.assets ?? []);
      setPaging(cached.paging ?? { after: null, nextAfter: null });
    }
    void load({ query, append: false, background: Boolean(cached) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.token, studio.syncNonce]);

  const didMountRef = React.useRef(false);
  const loadRef = React.useRef(load);
  React.useEffect(() => {
    loadRef.current = load;
  }, [load]);

  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const query = q.trim();
    const cached = readStudioDataCache<AssetsListCacheV1>(assetsListCacheKey(query))?.value ?? null;
    if (cached) {
      setAssets(cached.assets ?? []);
      setPaging(cached.paging ?? { after: null, nextAfter: null });
    }
    const t = window.setTimeout(() => {
      void loadRef.current({ query, append: false, background: Boolean(cached) });
    }, 260);
    return () => window.clearTimeout(t);
  }, [q]);

  const clearStage = React.useCallback(() => {
    setStagedUploads((prev) => {
      for (const s of prev) if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return [];
    });
    setStagedDeletes([]);
  }, []);

  const stageUpload = React.useCallback(
    async (file: File) => {
      if (!studio.token) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const uploadName = buildUploadName(file);
        const stagedUrl = `/uploads/${uploadName}`;
        const stagedPath = `public/uploads/${uploadName}`;
        const contentBase64 = await fileToBase64(file);
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;

        setStagedUploads((prev) => [
          ...prev,
          {
            name: uploadName,
            path: stagedPath,
            url: stagedUrl,
            bytes: file.size,
            contentType: file.type || "application/octet-stream",
            contentBase64,
            previewUrl,
          },
        ]);

        setNotice(`Staged: ${stagedUrl} (publish when ready)`);
      } catch (err: unknown) {
        setNotice(`Stage failed: ${formatStudioError(err).message}`);
      } finally {
        setBusy(false);
      }
    },
    [studio.token],
  );

  const toggleStageDelete = React.useCallback(
    (asset: Asset) => {
      setStagedDeletes((prev) => {
        const set = new Set(prev);
        if (set.has(asset.path)) set.delete(asset.path);
        else set.add(asset.path);
        return Array.from(set);
      });
      setNotice(null);
      setCommitUrl(null);
    },
    [],
  );

  const publishStaged = React.useCallback(async () => {
    if (!studio.token) return;
    if (!stagedUploads.length && !stagedDeletes.length) return;
    if (stagedDeletes.length) {
      const ok = window.confirm(
        stagedUploads.length
          ? `Publish ${stagedUploads.length} upload(s) and delete ${stagedDeletes.length} file(s)?`
          : `Delete ${stagedDeletes.length} file(s)?`,
      );
      if (!ok) return;
    }

    const subject = (() => {
      if (stagedUploads.length && !stagedDeletes.length) {
        const one = stagedUploads.length === 1 ? stagedUploads[0]?.name ?? "asset" : `${stagedUploads.length} files`;
        const s = `assets: upload ${one}`;
        return s.length > 72 ? `${s.slice(0, 71)}…` : s;
      }
      if (!stagedUploads.length && stagedDeletes.length) {
        const one = stagedDeletes.length === 1 ? stagedDeletes[0]?.split("/").at(-1) ?? "asset" : `${stagedDeletes.length} files`;
        const s = `assets: delete ${one}`;
        return s.length > 72 ? `${s.slice(0, 71)}…` : s;
      }
      const s = `assets: ${stagedUploads.length} uploads, ${stagedDeletes.length} deletes`;
      return s.length > 72 ? `${s.slice(0, 71)}…` : s;
    })();

    const bodyLines = [
      ...(stagedUploads.length ? [`uploads: ${stagedUploads.length}`] : []),
      ...(stagedDeletes.length ? [`deletes: ${stagedDeletes.length}`] : []),
    ];
    const message = bodyLines.length ? `${subject}\n\n${bodyLines.join("\n")}` : subject;

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<CommitResponse>({
        path: "/api/admin/commit",
        method: "POST",
        token: studio.token,
        body: {
          message,
          expectedHeadSha: studio.me?.repo.headSha,
          files: stagedUploads.map((u) => ({ path: u.path, encoding: "base64" as const, contentBase64: u.contentBase64 })),
          deletes: stagedDeletes,
        },
      });
      setNotice("Published.");
      setCommitUrl(res.commit.url);
      clearStage();
      await studio.refreshMe();
      await load({ append: false, query: q });
    } catch (err: unknown) {
      const e = formatStudioError(err);
      setNotice(e.code === "HEAD_MOVED" ? "Conflict: main moved. Refresh and retry." : `Publish failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, studio.me?.repo.headSha, studio.refreshMe, stagedUploads, stagedDeletes, clearStage, load, q]);

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
          <div className="mt-1 text-sm text-[hsl(var(--muted))]">
            Browse files under <code>public/uploads/</code>. Stage changes locally, then publish once.
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]">
            <ImagePlus className="h-3.5 w-3.5 opacity-85" />
            Stage
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void stageUpload(f);
                e.currentTarget.value = "";
              }}
              disabled={!studio.token || busy}
            />
          </label>
          <button
            type="button"
            onClick={() => void publishStaged()}
            disabled={!studio.token || busy || (!stagedUploads.length && !stagedDeletes.length)}
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition",
              !studio.token || busy || (!stagedUploads.length && !stagedDeletes.length)
                ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]",
            ].join(" ")}
            title="Publish staged uploads/deletes"
          >
            <ArrowUpRight className="h-3.5 w-3.5 opacity-85" />
            Publish
          </button>
          {(stagedUploads.length || stagedDeletes.length) && (
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm("Clear staged changes?");
                if (!ok) return;
                clearStage();
                setNotice("Cleared stage.");
                setCommitUrl(null);
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Clear staged changes"
            >
              <X className="h-3.5 w-3.5 opacity-85" />
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => void load({ append: false, query: q })}
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
        <div className="text-xs text-[hsl(var(--muted))]">{busy || refreshing ? "Loading…" : `${assets.length} items`}</div>
      </div>

      {error ? (
        <div className="border-b border-[hsl(var(--border))] bg-[color-mix(in_oklab,white_60%,transparent)] px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto bg-[hsl(var(--bg))] p-4">
        {assets.length === 0 && stagedUploads.length === 0 && !busy ? (
          <div className="card p-6 text-sm text-[hsl(var(--muted))]">No assets yet. Upload one, or pull your repo locally if you published from another machine.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stagedUploads.map((u) => {
              const isImage = u.contentType.startsWith("image/");
              return (
                <div key={u.path} className="card overflow-hidden border-[color-mix(in_oklab,hsl(var(--accent))_35%,hsl(var(--border)))]">
                  <div className="relative aspect-[4/3] bg-[hsl(var(--card2))]">
                    {isImage && u.previewUrl ? (
                      <img src={u.previewUrl} alt={u.url} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--muted))]">
                        <FileText className="h-8 w-8 opacity-60" />
                      </div>
                    )}
                    <div className="absolute left-2 top-2 rounded-full border border-[hsl(var(--border))] bg-[color-mix(in_oklab,hsl(var(--card))_85%,transparent)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">
                      STAGED
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStagedUploads((prev) => {
                          const next = prev.filter((x) => x.path !== u.path);
                          if (u.previewUrl) URL.revokeObjectURL(u.previewUrl);
                          return next;
                        });
                        setNotice("Removed from stage.");
                        setCommitUrl(null);
                      }}
                      className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[color-mix(in_oklab,hsl(var(--card))_80%,transparent)] p-2 text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card))] hover:text-[hsl(var(--fg))]"
                      title="Remove staged upload"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-3">
                    <div className="truncate text-xs font-medium tracking-tight">{u.url}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[hsl(var(--muted))]">
                      <span className="truncate">{formatBytes(u.bytes)}</span>
                      <span className="truncate">{u.contentType}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyText(u.url);
                          setNotice(ok ? `Copied URL: ${u.url}` : "Copy failed.");
                          setCommitUrl(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                        title="Copy URL"
                      >
                        <Copy className="h-3.5 w-3.5 opacity-85" />
                        URL
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const md = `![](${u.url})`;
                          const ok = await copyText(md);
                          setNotice(ok ? "Copied Markdown." : "Copy failed.");
                          setCommitUrl(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                        title="Copy Markdown"
                      >
                        <Check className="h-3.5 w-3.5 opacity-85" />
                        MD
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {assets.map((a) => {
              const isImage = a.contentType.startsWith("image/");
              const deleting = stagedDeletes.includes(a.path);
              return (
                <div key={a.path} className={["card overflow-hidden", deleting ? "opacity-60" : ""].join(" ")}>
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
                    {deleting ? (
                      <div className="absolute left-2 top-2 rounded-full border border-[hsl(var(--border))] bg-[color-mix(in_oklab,hsl(var(--card))_85%,transparent)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">
                        STAGED DELETE
                      </div>
                    ) : null}
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
                        onClick={() => toggleStageDelete(a)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
                        title={deleting ? "Undo delete" : "Stage delete"}
                      >
                        <Trash2 className="h-3.5 w-3.5 opacity-85" />
                        {deleting ? "Undo" : "Del"}
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
            onClick={() => void load({ append: true, query: q })}
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
