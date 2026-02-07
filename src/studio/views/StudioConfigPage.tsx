import { Check, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import React from "react";
import { publisherFetchJson } from "../../ui/publisher/client";
import { useStudioState } from "../state/StudioState";

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

  const [active, setActive] = React.useState<FileKey>("profile");
  const file = React.useMemo(() => FILES.find((f) => f.key === active)!, [active]);

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
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Load failed: ${msg}`);
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
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Save failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, file.mode, file.putPath, raw]);

  const jsonError = React.useMemo(() => {
    if (file.mode !== "json") return null;
    const parsed = tryParseJson(raw);
    return parsed.ok ? null : parsed.error;
  }, [file.mode, raw]);

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

        <textarea
          value={raw}
          onChange={(e) => {
            setDirty(true);
            setRaw(e.target.value);
          }}
          className="h-full w-full resize-none bg-[hsl(var(--bg))] px-4 py-4 font-mono text-sm leading-6 outline-none placeholder:text-[hsl(var(--muted))]"
          placeholder={file.mode === "json" ? "{\n  ...\n}" : "- id: ..."}
        />
      </section>
    </div>
  );
}

