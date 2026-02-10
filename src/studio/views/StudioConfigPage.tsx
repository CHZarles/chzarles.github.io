import { Check, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import React from "react";
import { useSearchParams } from "react-router-dom";
import YAML from "yaml";
import { publisherFetchJson } from "../../ui/publisher/client";
import type { Category } from "../../ui/types";
import { useStudioState } from "../state/StudioState";
import { formatStudioError } from "../util/errors";

type FileKey = "profile" | "categories" | "projects";
type FileMode = "json" | "yaml";

type FileInfo = {
  key: FileKey;
  label: string;
  mode: FileMode;
  getPath: string;
  putPath: string;
};

const FILES: FileInfo[] = [
  { key: "profile", label: "Profile", mode: "json", getPath: "/api/admin/profile", putPath: "/api/admin/profile" },
  { key: "categories", label: "Categories", mode: "yaml", getPath: "/api/admin/categories", putPath: "/api/admin/categories" },
  { key: "projects", label: "Projects", mode: "json", getPath: "/api/admin/projects", putPath: "/api/admin/projects" },
];

type GetFileResponse = {
  file: { path: string; raw: string; json: unknown };
};

function isValidCategoryId(id: string): boolean {
  return /^[a-z0-9-]{2,80}$/.test(id);
}

const CATEGORY_TONES: Array<NonNullable<Category["tone"]>> = ["neutral", "cyan", "violet", "lime", "amber", "rose"];

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
  const [active, setActive] = React.useState<FileKey>(initialKey ?? "profile");
  const file = React.useMemo(() => FILES.find((f) => f.key === active)!, [active]);

  const [categoriesView, setCategoriesView] = React.useState<"form" | "yaml">("form");

  const [raw, setRaw] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!studio.token) return;
    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<GetFileResponse>({ path: file.getPath, token: studio.token });
      setRaw(res.file.raw ?? "");
      setDirty(false);
    } catch (err: unknown) {
      setNotice(`Load failed: ${formatStudioError(err).message}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, file.getPath]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const formatJson = React.useCallback(() => {
    const parsed = tryParseJson(raw);
    if (!parsed.ok) {
      setNotice(`Format failed: ${parsed.error}`);
      return;
    }
    setRaw(JSON.stringify(parsed.value, null, 2) + "\n");
    setDirty(true);
  }, [raw]);

  const save = React.useCallback(async () => {
    if (!studio.token) return;
    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const body = file.mode === "json" ? { raw } : { yaml: raw };
      const res = await publisherFetchJson<{ ok: true; file: { path: string }; commit: { sha: string; url: string } }>({
        path: file.putPath,
        method: "PUT",
        token: studio.token,
        body,
      });
      setNotice(`Saved: ${res.file.path}`);
      setCommitUrl(res.commit.url);
      setDirty(false);
    } catch (err: unknown) {
      setNotice(`Save failed: ${formatStudioError(err).message}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, file.mode, file.putPath, raw]);

  const jsonError = React.useMemo(() => {
    if (file.mode !== "json") return null;
    const parsed = tryParseJson(raw);
    return parsed.ok ? null : parsed.error;
  }, [file.mode, raw]);

  const categoriesState = React.useMemo(() => {
    if (active !== "categories") return null;
    try {
      const parsed = YAML.parse(raw);
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
                    onClick={() => setActive(f.key)}
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
              {dirty ? <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">unsaved</span> : null}
            </div>
            {studio.me ? (
              <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                @{studio.me.user.login} · {studio.me.repo.fullName}@{studio.me.repo.branch}
              </div>
            ) : null}
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
              <RefreshCw className="h-3.5 w-3.5 opacity-85" />
              Reload
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!studio.token || busy}
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition",
                !studio.token || busy
                  ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                  : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]",
              ].join(" ")}
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              Save
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
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[hsl(var(--muted))]">
                    Edit <code>content/categories.yml</code>. IDs should be <code>a-z0-9-</code>.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [
                        ...(categoriesState.categories ?? []),
                        { id: "", title: "", description: "", tone: "neutral" as const },
                      ];
                      setRaw(YAML.stringify(next).trimEnd() + "\n");
                      setDirty(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                    title="Add category"
                  >
                    + Add
                  </button>
                </div>

                <div className="grid gap-3">
                  {(categoriesState.categories ?? []).map((c, idx) => {
                    const id = String((c as any).id ?? "");
                    const title = String((c as any).title ?? "");
                    const description = typeof (c as any).description === "string" ? (c as any).description : "";
                    const tone = (CATEGORY_TONES.includes((c as any).tone) ? (c as any).tone : "neutral") as NonNullable<
                      Category["tone"]
                    >;
                    const idOk = !id || isValidCategoryId(id);
                    return (
                      <div key={`${idx}:${id}`} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                        <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
                          <div className="grid gap-2">
                            <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">ID</div>
                            <input
                              value={id}
                              onChange={(e) => {
                                const next = [...(categoriesState.categories ?? [])];
                                (next[idx] as any).id = e.target.value.trim().toLowerCase();
                                setRaw(YAML.stringify(next).trimEnd() + "\n");
                                setDirty(true);
                              }}
                              placeholder="ai-infra"
                              className={[
                                "w-full rounded-xl border bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]",
                                idOk ? "border-[hsl(var(--border))]" : "border-[color-mix(in_oklab,red_50%,hsl(var(--border)))]",
                              ].join(" ")}
                            />
                            {!idOk ? <div className="text-[10px] text-red-700">Invalid id. Use a-z0-9-.</div> : null}
                          </div>

                          <div className="grid gap-3">
                            <div className="grid gap-2">
                              <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">TITLE</div>
                              <input
                                value={title}
                                onChange={(e) => {
                                  const next = [...(categoriesState.categories ?? [])];
                                  (next[idx] as any).title = e.target.value;
                                  setRaw(YAML.stringify(next).trimEnd() + "\n");
                                  setDirty(true);
                                }}
                                placeholder="AI Infra"
                                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]"
                              />
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="grid gap-2">
                                <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">TONE</div>
                                <select
                                  value={tone}
                                  onChange={(e) => {
                                    const next = [...(categoriesState.categories ?? [])];
                                    (next[idx] as any).tone = e.target.value;
                                    setRaw(YAML.stringify(next).trimEnd() + "\n");
                                    setDirty(true);
                                  }}
                                  className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                                >
                                  {CATEGORY_TONES.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid gap-2">
                                <div className="text-[10px] font-semibold tracking-wide text-[hsl(var(--muted))]">DESCRIPTION</div>
                                <input
                                  value={description}
                                  onChange={(e) => {
                                    const next = [...(categoriesState.categories ?? [])];
                                    (next[idx] as any).description = e.target.value;
                                    setRaw(YAML.stringify(next).trimEnd() + "\n");
                                    setDirty(true);
                                  }}
                                  placeholder="Optional"
                                  className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const ok = window.confirm(`Delete category "${title || id || "Untitled"}"?`);
                                  if (!ok) return;
                                  const next = [...(categoriesState.categories ?? [])];
                                  next.splice(idx, 1);
                                  setRaw(YAML.stringify(next).trimEnd() + "\n");
                                  setDirty(true);
                                }}
                                className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
