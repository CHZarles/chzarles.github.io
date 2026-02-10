import { Check, ChevronDown, ChevronUp, ExternalLink, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import React from "react";
import { useSearchParams } from "react-router-dom";
import YAML from "yaml";
import { publisherFetchJson } from "../../ui/publisher/client";
import { PUBLISHER_BASE_URL } from "../../ui/publisher/config";
import type { Category } from "../../ui/types";
import { useRegisterStudioHeaderActions } from "../state/StudioHeaderActions";
import { useStudioState } from "../state/StudioState";
import { formatStudioError } from "../util/errors";

type FileKey = "profile" | "categories" | "projects";
type FileMode = "json" | "yaml";

type FileInfo = {
  key: FileKey;
  label: string;
  mode: FileMode;
  contentPath: string;
  getPath: string;
  putPath: string;
};

const FILES: FileInfo[] = [
  {
    key: "profile",
    label: "Profile",
    mode: "json",
    contentPath: "content/profile.json",
    getPath: "/api/admin/profile",
    putPath: "/api/admin/profile",
  },
  {
    key: "categories",
    label: "Categories",
    mode: "yaml",
    contentPath: "content/categories.yml",
    getPath: "/api/admin/categories",
    putPath: "/api/admin/categories",
  },
  {
    key: "projects",
    label: "Projects",
    mode: "json",
    contentPath: "content/projects.json",
    getPath: "/api/admin/projects",
    putPath: "/api/admin/projects",
  },
];

type GetFileResponse = {
  file: { path: string; raw: string; json: unknown };
};

function isValidCategoryId(id: string): boolean {
  return /^[a-z0-9-]{2,80}$/.test(id);
}

const CATEGORY_TONES: Array<NonNullable<Category["tone"]>> = ["neutral", "cyan", "violet", "lime", "amber", "rose"];

const CONFIG_CACHE_PREFIX = "hyperblog.studio.cache.config:v1:";
const CONFIG_DRAFT_PREFIX = "hyperblog.studio.draft.config:v1:";

type ConfigCacheV1 = {
  v: 1;
  savedAt: number;
  path: string;
  raw: string;
};

type ConfigDraftV1 = {
  v: 1;
  savedAt: number;
  raw: string;
};

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function configCacheKey(fileKey: FileKey): string {
  return `${CONFIG_CACHE_PREFIX}${PUBLISHER_BASE_URL}:${fileKey}`;
}

function readConfigCache(fileKey: FileKey): ConfigCacheV1 | null {
  const raw = safeLocalStorageGet(configCacheKey(fileKey));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as ConfigCacheV1;
    if (!v || typeof v !== "object") return null;
    if (v.v !== 1) return null;
    if (typeof v.savedAt !== "number") return null;
    if (typeof v.path !== "string") return null;
    if (typeof v.raw !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

function writeConfigCache(fileKey: FileKey, entry: { path: string; raw: string }) {
  const payload: ConfigCacheV1 = { v: 1, savedAt: Date.now(), path: entry.path, raw: entry.raw };
  safeLocalStorageSet(configCacheKey(fileKey), JSON.stringify(payload));
}

function configDraftKey(fileKey: FileKey): string {
  return `${CONFIG_DRAFT_PREFIX}${PUBLISHER_BASE_URL}:${fileKey}`;
}

function readConfigDraft(fileKey: FileKey): ConfigDraftV1 | null {
  const raw = safeLocalStorageGet(configDraftKey(fileKey));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as ConfigDraftV1;
    if (!v || typeof v !== "object") return null;
    if (v.v !== 1) return null;
    if (typeof v.savedAt !== "number") return null;
    if (typeof v.raw !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

function writeConfigDraft(fileKey: FileKey, entry: { raw: string }): { ok: true; savedAt: number } | { ok: false; error: string } {
  const payload: ConfigDraftV1 = { v: 1, savedAt: Date.now(), raw: entry.raw };
  try {
    localStorage.setItem(configDraftKey(fileKey), JSON.stringify(payload));
    return { ok: true, savedAt: payload.savedAt };
  } catch {
    return { ok: false, error: "Local save failed (storage unavailable or full)." };
  }
}

function deleteConfigDraft(fileKey: FileKey): void {
  safeLocalStorageRemove(configDraftKey(fileKey));
}

function toneSwatch(tone: NonNullable<Category["tone"]>): string {
  switch (tone) {
    case "cyan":
      return "190 95% 55%";
    case "violet":
      return "270 90% 63%";
    case "lime":
      return "95 85% 55%";
    case "amber":
      return "40 95% 55%";
    case "rose":
      return "350 85% 63%";
    case "neutral":
    default:
      return "0 0% 65%";
  }
}

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export function StudioConfigPage() {
  const studio = useStudioState();

  const [searchParams] = useSearchParams();
  const initial = searchParams.get("file");
  const initialKey = (initial === "profile" || initial === "categories" || initial === "projects" ? initial : null) as FileKey | null;
  const initialActive = initialKey ?? "profile";
  const [active, setActive] = React.useState<FileKey>(initialActive);
  const file = React.useMemo(() => FILES.find((f) => f.key === active)!, [active]);

  const [categoriesView, setCategoriesView] = React.useState<"form" | "yaml">("form");

  const [raw, setRaw] = React.useState(() => readConfigDraft(initialActive)?.raw ?? readConfigCache(initialActive)?.raw ?? "");
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);
  const [localSavedAt, setLocalSavedAt] = React.useState<number | null>(() => readConfigDraft(initialActive)?.savedAt ?? null);

  const dirtyRef = React.useRef(dirty);
  React.useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const activeRef = React.useRef(active);
  React.useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const loadSeqRef = React.useRef(0);

  const load = React.useCallback(async (opts?: { background?: boolean }) => {
    if (!studio.token) return;
    const seq = (loadSeqRef.current += 1);
    const fileKey = activeRef.current;
    const background = Boolean(opts?.background);
    if (background) setRefreshing(true);
    else setBusy(true);
    if (!background) {
      setNotice(null);
      setCommitUrl(null);
    }
    try {
      const res = await publisherFetchJson<GetFileResponse>({ path: file.getPath, token: studio.token });
      if (seq !== loadSeqRef.current) return;
      const nextRaw = res.file.raw ?? "";
      writeConfigCache(fileKey, { path: res.file.path, raw: nextRaw });
      const hasDraft = Boolean(readConfigDraft(fileKey));
      if (!dirtyRef.current && !hasDraft) {
        setRaw(nextRaw);
        setDirty(false);
        setLocalSavedAt(null);
      }
    } catch (err: unknown) {
      if (seq !== loadSeqRef.current) return;
      const msg = formatStudioError(err).message;
      if (!background) setNotice(`Load failed: ${msg}`);
    } finally {
      if (seq !== loadSeqRef.current) return;
      if (background) setRefreshing(false);
      else setBusy(false);
    }
  }, [studio.token, file.getPath]);

  React.useEffect(() => {
    const draft = readConfigDraft(active);
    const cached = readConfigCache(active);
    if (!dirtyRef.current) {
      setRaw(draft?.raw ?? cached?.raw ?? "");
      setDirty(false);
      setLocalSavedAt(draft?.savedAt ?? null);
    }
    if (studio.token) void load({ background: Boolean(draft || cached) });
  }, [active, studio.token, studio.syncNonce, load]);

  const formatJson = React.useCallback(() => {
    const parsed = tryParseJson(raw);
    if (!parsed.ok) {
      setNotice(`Format failed: ${parsed.error}`);
      return;
    }
    setRaw(JSON.stringify(parsed.value, null, 2) + "\n");
    setDirty(true);
  }, [raw]);

  const saveLocal = React.useCallback(
    (opts?: { quiet?: boolean }): boolean => {
      const fileKey = activeRef.current;
      const out = writeConfigDraft(fileKey, { raw });
      if (!out.ok) {
        setNotice(out.error);
        return false;
      }
      setLocalSavedAt(out.savedAt);
      setDirty(false);
      setCommitUrl(null);
      if (!opts?.quiet) setNotice("Saved locally.");
      return true;
    },
    [raw],
  );

  React.useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      saveLocal({ quiet: true });
    }, 650);
    return () => window.clearTimeout(t);
  }, [dirty, raw, saveLocal]);

  const publish = React.useCallback(async () => {
    if (!studio.token) return;
    const fileKey = active;

    const normalized = (() => {
      if (file.mode === "json") {
        const parsed = tryParseJson(raw);
        if (!parsed.ok) return { ok: false as const, error: parsed.error };
        if (fileKey === "profile" && (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value))) {
          return { ok: false as const, error: "Profile must be a JSON object." };
        }
        if (fileKey === "projects" && !Array.isArray(parsed.value)) {
          return { ok: false as const, error: "Projects must be a JSON array." };
        }
        return { ok: true as const, raw: JSON.stringify(parsed.value, null, 2) + "\n" };
      }

      try {
        const v = YAML.parse(raw);
        if (fileKey === "categories" && raw.trim() && !Array.isArray(v)) {
          return { ok: false as const, error: "Categories YAML must be a list." };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false as const, error: msg };
      }
      return { ok: true as const, raw: raw.trimEnd() + "\n" };
    })();

    if (!normalized.ok) {
      setNotice(`${file.mode.toUpperCase()} error: ${normalized.error}`);
      return;
    }

    const subject = `config: ${fileKey}`;
    const message = `${subject}\n\npath: ${file.contentPath}`;

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<{ commit: { sha: string; url: string; headSha?: string } }>({
        path: "/api/admin/commit",
        method: "POST",
        token: studio.token,
        body: {
          message,
          expectedHeadSha: studio.me?.repo.headSha ?? undefined,
          files: [{ path: file.contentPath, encoding: "utf8", content: normalized.raw }],
        },
      });

      writeConfigCache(fileKey, { path: file.contentPath, raw: normalized.raw });
      deleteConfigDraft(fileKey);
      setLocalSavedAt(null);
      setDirty(false);
      setNotice(`Published: ${file.contentPath}`);
      setCommitUrl(res.commit.url);
      setRaw(normalized.raw);
      void studio.refreshMe();
    } catch (err: unknown) {
      const e = formatStudioError(err);
      setNotice(e.code === "HEAD_MOVED" ? "Conflict: main moved. Sync and retry." : `Publish failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, studio.me?.repo.headSha, studio.refreshMe, active, file.mode, file.contentPath, raw]);

  const canPublish = Boolean(studio.token) && !busy && (dirty || Boolean(localSavedAt));
  const headerPublish = React.useMemo(
    () => ({
      label: "Publish",
      title: `Publish ${file.label} to GitHub (commit) (⌘Enter / Ctrl+Enter)`,
      disabled: !canPublish,
      onClick: () => void publish(),
    }),
    [canPublish, file.label, publish],
  );
  useRegisterStudioHeaderActions({ publish: headerPublish });

  const discardLocal = React.useCallback(() => {
    const fileKey = activeRef.current;
    const ok = window.confirm("Discard local changes for this file?");
    if (!ok) return;
    deleteConfigDraft(fileKey);
    setLocalSavedAt(null);
    setDirty(false);
    const cached = readConfigCache(fileKey);
    setRaw(cached?.raw ?? "");
    setNotice("Local changes discarded.");
    setCommitUrl(null);
  }, []);

  const jsonError = React.useMemo(() => {
    if (file.mode !== "json") return null;
    if (!raw.trim()) return null;
    const parsed = tryParseJson(raw);
    return parsed.ok ? null : parsed.error;
  }, [file.mode, raw]);

  const categoriesState = React.useMemo(() => {
    if (active !== "categories") return null;
    try {
      const trimmed = raw.trim();
      if (!trimmed) return { ok: true as const, error: null, categories: [] as Array<Category & Record<string, unknown>> };
      const parsed = YAML.parse(trimmed);
      if (!Array.isArray(parsed)) return { ok: false as const, error: "YAML must be a list of categories.", categories: null };
      const categories = parsed
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const o = it as Record<string, unknown>;
          const id = String(o.id ?? "")
            .trim()
            .toLowerCase();
          const title = String(o.title ?? "").trim();
          const description = typeof o.description === "string" ? o.description : undefined;
          const tone = CATEGORY_TONES.includes(o.tone as any) ? (o.tone as Category["tone"]) : undefined;
          return { ...o, id, title, description, tone } as Category & Record<string, unknown>;
        })
        .filter((x): x is Category & Record<string, unknown> => Boolean(x));
      return { ok: true as const, error: null, categories };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg, categories: null };
    }
  }, [active, raw]);

  const categoriesList = React.useMemo(() => {
    if (!categoriesState || !categoriesState.ok) return [] as Array<Category & Record<string, unknown>>;
    return categoriesState.categories ?? [];
  }, [categoriesState]);

  const categoryIdCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categoriesList) {
      const id = String((c as any).id ?? "")
        .trim()
        .toLowerCase();
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [categoriesList]);

  const setCategoriesYaml = React.useCallback((next: Array<Record<string, unknown>>) => {
    setRaw(YAML.stringify(next).trimEnd() + "\n");
    setDirty(true);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cmd = e.ctrlKey || e.metaKey;
      if (!cmd) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        saveLocal();
        return;
      }
      if (key === "enter") {
        e.preventDefault();
        void publish();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [publish, saveLocal]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-h-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
        <div className="px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">CONFIG</div>
        </div>
        <div className="min-h-0 overflow-auto px-2 pb-4">
          <ul className="grid gap-1">
            {FILES.map((f) => {
              const isActive = f.key === active;
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (busy) return;
                      if (f.key === active) return;
                      if (dirty) {
                        const ok = saveLocal({ quiet: true });
                        if (!ok) return;
                      }
                      const draft = readConfigDraft(f.key);
                      const cached = readConfigCache(f.key);
                      setRaw(draft?.raw ?? cached?.raw ?? "");
                      setLocalSavedAt(draft?.savedAt ?? null);
                      setDirty(false);
                      setNotice(null);
                      setCommitUrl(null);
                      setActive(f.key);
                    }}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left transition",
                      isActive ? "bg-[hsl(var(--card2))] text-[hsl(var(--fg))]" : "hover:bg-[hsl(var(--card2))]",
                    ].join(" ")}
                  >
                    <div className="text-sm font-medium tracking-tight">{f.label}</div>
                    <div className="mt-0.5 text-xs text-[hsl(var(--muted))]">{f.mode.toUpperCase()}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

	      <section className="min-h-0 min-w-0 bg-[hsl(var(--bg))]">
	        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
	          <div className="min-w-0">
	            <div className="flex items-center gap-2">
	              <div className="truncate text-sm font-semibold tracking-tight">{file.label}</div>
	              {dirty ? (
	                <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">unsaved</span>
	              ) : localSavedAt ? (
	                <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">saved local</span>
	              ) : null}
	            </div>
	            {studio.me ? (
	              <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
	                @{studio.me.user.login} · {studio.me.repo.fullName}@{studio.me.repo.branch}
	              </div>
	            ) : null}
	            <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">Local drafts auto-save in your browser. Publish writes a GitHub commit.</div>
	          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {active === "categories" ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCategoriesView("form")}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs transition",
                    categoriesView === "form"
                      ? "bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))]"
                      : "text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
                  ].join(" ")}
                  title="Edit categories with a form"
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setCategoriesView("yaml")}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs transition",
                    categoriesView === "yaml"
                      ? "bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))]"
                      : "text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
                  ].join(" ")}
                  title="Edit categories.yml directly"
                >
                  YAML
                </button>
              </div>
            ) : null}
            {file.mode === "json" ? (
              <button
                type="button"
                onClick={formatJson}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
                title="Format JSON"
              >
                <Sparkles className="h-3.5 w-3.5 opacity-85" />
                Format
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
            >
              <RefreshCw className={["h-3.5 w-3.5 opacity-85", refreshing ? "animate-spin" : ""].join(" ")} />
              Reload
            </button>
            <button
              type="button"
              onClick={() => saveLocal()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Save locally (⌘S / Ctrl+S)"
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              Save local
            </button>
            <button
              type="button"
              onClick={discardLocal}
              disabled={busy || (!dirty && !localSavedAt)}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Discard local changes"
            >
              <X className="h-3.5 w-3.5 opacity-85" />
              Discard
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

        {jsonError ? (
          <div className="border-b border-[hsl(var(--border))] bg-[color-mix(in_oklab,white_60%,transparent)] px-4 py-2 text-xs text-red-700">
            JSON error: {jsonError}
          </div>
        ) : null}

        {active === "categories" && categoriesView === "form" ? (
          <div className="h-full min-h-0 overflow-auto px-4 py-4">
            {categoriesState && !categoriesState.ok ? (
              <div className="rounded-xl border border-[color-mix(in_oklab,red_40%,hsl(var(--border)))] bg-[color-mix(in_oklab,red_6%,hsl(var(--card)))] px-4 py-3 text-sm text-red-700">
                Parse error: {categoriesState.error}
                <div className="mt-2 text-xs text-[hsl(var(--muted))]">Switch to YAML to fix it.</div>
              </div>
            ) : null}

            {categoriesState && categoriesState.ok ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tracking-tight">
                      Categories <span className="text-xs font-medium text-[hsl(var(--muted))]">· {categoriesList.length}</span>
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                      IDs are stable keys used in note frontmatter. Use <code>a-z0-9-</code>; rename titles freely.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = [...categoriesList, { id: "", title: "", description: "", tone: "neutral" as const }];
                      setCategoriesYaml(next);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                    title="Add category"
                  >
                    <Plus className="h-3.5 w-3.5 opacity-85" />
                    Add
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                  <div className="hidden grid-cols-[180px_minmax(0,1fr)_160px_minmax(0,1fr)_112px] items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-4 py-2 text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))] md:grid">
                    <div>ID</div>
                    <div>Title</div>
                    <div>Tone</div>
                    <div>Description</div>
                    <div className="text-right">Actions</div>
                  </div>

                  <div className="divide-y divide-[hsl(var(--border))]">
                    {categoriesList.map((c, idx) => {
                      const id = String((c as any).id ?? "");
                      const title = String((c as any).title ?? "");
                      const description = typeof (c as any).description === "string" ? (c as any).description : "";
                      const tone = (CATEGORY_TONES.includes((c as any).tone) ? (c as any).tone : "neutral") as NonNullable<
                        Category["tone"]
                      >;

                      const idLower = id.trim().toLowerCase();
                      const idOk = !id || isValidCategoryId(idLower);
                      const idDup = Boolean(idLower) && (categoryIdCounts.get(idLower) ?? 0) > 1;

                      const update = (patch: Record<string, unknown>) => {
                        const next = [...categoriesList];
                        next[idx] = { ...(next[idx] as any), ...patch } as any;
                        setCategoriesYaml(next);
                      };

                      const move = (to: number) => {
                        const next = [...categoriesList];
                        const [it] = next.splice(idx, 1);
                        next.splice(to, 0, it);
                        setCategoriesYaml(next);
                      };

                      const actionBtn = (disabled: boolean) =>
                        [
                          "inline-flex h-8 w-8 items-center justify-center rounded-full border transition",
                          disabled
                            ? "cursor-not-allowed border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))] opacity-60"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
                        ].join(" ");

                      return (
                        <div
                          key={`${idx}:${idLower || "new"}`}
                          className="border-l-4 border-l-transparent px-4 py-4"
                          style={{ borderLeftColor: `hsl(${toneSwatch(tone)})` }}
                        >
                          <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_160px_minmax(0,1fr)_112px] md:items-start">
                            <div className="grid gap-1.5">
                              <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))] md:hidden">ID</div>
                              <input
                                value={id}
                                onChange={(e) => update({ id: e.target.value.trim().toLowerCase() })}
                                placeholder="ai-infra"
                                aria-label="Category id"
                                className={[
                                  "w-full rounded-xl border bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]",
                                  idOk && !idDup
                                    ? "border-[hsl(var(--border))]"
                                    : "border-[color-mix(in_oklab,red_50%,hsl(var(--border)))]",
                                ].join(" ")}
                              />
                              {!idOk ? (
                                <div className="text-[10px] text-red-700">Use a-z0-9-.</div>
                              ) : idDup ? (
                                <div className="text-[10px] text-red-700">Duplicate id.</div>
                              ) : null}
                            </div>

                            <div className="grid gap-1.5">
                              <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))] md:hidden">TITLE</div>
                              <input
                                value={title}
                                onChange={(e) => update({ title: e.target.value })}
                                placeholder="AI Infra"
                                aria-label="Category title"
                                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]"
                              />
                            </div>

                            <div className="grid gap-1.5">
                              <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))] md:hidden">TONE</div>
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: `hsl(${toneSwatch(tone)})` }}
                                />
                                <select
                                  value={tone}
                                  onChange={(e) => update({ tone: e.target.value })}
                                  aria-label="Category tone"
                                  className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                                >
                                  {CATEGORY_TONES.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid gap-1.5">
                              <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))] md:hidden">DESCRIPTION</div>
                              <input
                                value={description}
                                onChange={(e) => update({ description: e.target.value })}
                                placeholder="Optional"
                                aria-label="Category description"
                                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => move(idx - 1)}
                                disabled={idx === 0}
                                className={actionBtn(idx === 0)}
                                title="Move up"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => move(idx + 1)}
                                disabled={idx === categoriesList.length - 1}
                                className={actionBtn(idx === categoriesList.length - 1)}
                                title="Move down"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const ok = window.confirm(`Delete category "${title || id || "Untitled"}"?`);
                                  if (!ok) return;
                                  const next = [...categoriesList];
                                  next.splice(idx, 1);
                                  setCategoriesYaml(next);
                                }}
                                className={actionBtn(false)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <textarea
            value={raw}
            onChange={(e) => {
              setDirty(true);
              setRaw(e.target.value);
            }}
            className="h-full w-full resize-none bg-[hsl(var(--bg))] px-4 py-4 font-mono text-sm leading-6 outline-none placeholder:text-[hsl(var(--muted))]"
            placeholder={file.mode === "json" ? "{\n  ...\n}" : "- id: ..."}
          />
        )}
      </section>
    </div>
  );
}
