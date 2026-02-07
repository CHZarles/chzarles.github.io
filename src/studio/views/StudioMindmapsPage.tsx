import { Check, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import React from "react";
import { publisherFetchJson } from "../../ui/publisher/client";
import { useStudioState } from "../state/StudioState";

type MindmapInput = {
  id: string;
  title?: string;
  format?: string;
  nodes?: unknown[];
  edges?: unknown[];
  viewport?: unknown;
  updated?: string;
};

type MindmapsListResponse = {
  mindmaps: Array<{
    id: string;
    path: string;
    sha: string;
    size: number;
    meta?: { title?: string; updated?: string; format?: string; nodeCount?: number; edgeCount?: number };
  }>;
  paging: { after: string | null; nextAfter: string | null };
};

type MindmapGetResponse = {
  mindmap: { id: string; path: string; input: MindmapInput; json: string };
};

function defaultJson() {
  return `{\n  \"format\": \"reactflow\",\n  \"nodes\": [],\n  \"edges\": [],\n  \"viewport\": { \"x\": 0, \"y\": 0, \"zoom\": 1 }\n}\n`;
}

export function StudioMindmapsPage() {
  const studio = useStudioState();

  const [mindmaps, setMindmaps] = React.useState<MindmapsListResponse["mindmaps"]>([]);
  const [paging, setPaging] = React.useState<MindmapsListResponse["paging"]>({ after: null, nextAfter: null });
  const [filter, setFilter] = React.useState("");
  const [listBusy, setListBusy] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [id, setId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [json, setJson] = React.useState(defaultJson());
  const [dirty, setDirty] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);

  const refreshList = React.useCallback(
    async (opts?: { append?: boolean }) => {
      if (!studio.token) return;
      setListBusy(true);
      setListError(null);
      try {
        const url = new URL("/api/admin/mindmaps", "http://local");
        url.searchParams.set("include", "meta");
        url.searchParams.set("limit", "50");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const res = await publisherFetchJson<MindmapsListResponse>({ path: url.pathname + url.search, token: studio.token });
        setMindmaps((prev) => (opts?.append ? [...prev, ...res.mindmaps] : res.mindmaps));
        setPaging(res.paging);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setListError(msg);
      } finally {
        setListBusy(false);
      }
    },
    [studio.token, paging.nextAfter],
  );

  React.useEffect(() => {
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.token]);

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return mindmaps;
    return mindmaps.filter((m) => m.id.toLowerCase().includes(q) || (m.meta?.title ?? "").toLowerCase().includes(q));
  }, [mindmaps, filter]);

  const newMindmap = React.useCallback(() => {
    setMode("create");
    setId("");
    setTitle("");
    setJson(defaultJson());
    setDirty(false);
    setNotice(null);
    setCommitUrl(null);
  }, []);

  const openMindmap = React.useCallback(
    async (mid: string) => {
      if (!studio.token) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherFetchJson<MindmapGetResponse>({
          path: `/api/admin/mindmaps/${encodeURIComponent(mid)}`,
          token: studio.token,
        });
        setMode("edit");
        setId(res.mindmap.id);
        setTitle(res.mindmap.input.title ?? "");
        setJson(res.mindmap.json ?? defaultJson());
        setDirty(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(`Open failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [studio.token],
  );

  const save = React.useCallback(async () => {
    if (!studio.token) return;
    const mmid = id.trim().toLowerCase();
    if (!mmid) {
      setNotice("Missing id.");
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = (json.trim() ? JSON.parse(json) : {}) as Record<string, unknown>;
    } catch {
      setNotice("Invalid JSON.");
      return;
    }

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const payload: MindmapInput = {
        id: mmid,
        title: title.trim() || undefined,
        format: typeof parsed.format === "string" ? parsed.format : undefined,
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : undefined,
        edges: Array.isArray(parsed.edges) ? parsed.edges : undefined,
        viewport: parsed.viewport ?? undefined,
      };

      if (mode === "create") {
        const res = await publisherFetchJson<{
          mindmap: { id: string; path: string };
          commit: { sha: string; url: string };
        }>({ path: "/api/admin/mindmaps", method: "POST", token: studio.token, body: payload });
        setMode("edit");
        setNotice(`Published: ${res.mindmap.id}`);
        setCommitUrl(res.commit.url);
      } else {
        const res = await publisherFetchJson<{
          mindmap: { id: string; path: string };
          commit: { sha: string; url: string };
        }>({ path: `/api/admin/mindmaps/${encodeURIComponent(mmid)}`, method: "PATCH", token: studio.token, body: payload });
        setNotice(`Saved: ${res.mindmap.id}`);
        setCommitUrl(res.commit.url);
      }

      setDirty(false);
      void refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Save failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, mode, id, title, json, refreshList]);

  const del = React.useCallback(async () => {
    if (!studio.token) return;
    const mmid = id.trim().toLowerCase();
    if (!mmid) return;
    const ok = window.confirm(`Trash mindmap ${mmid}?`);
    if (!ok) return;

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<{ ok: true; commit: { sha: string; url: string } }>({
        path: `/api/admin/mindmaps/${encodeURIComponent(mmid)}`,
        method: "DELETE",
        token: studio.token,
      });
      setNotice("Trashed.");
      setCommitUrl(res.commit.url);
      setDirty(false);
      newMindmap();
      void refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Delete failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, id, newMindmap, refreshList]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="min-h-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">MINDMAPS</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={newMindmap}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
            >
              <Plus className="h-3.5 w-3.5 opacity-85" />
              New
            </button>
            <button
              type="button"
              onClick={() => void refreshList()}
              disabled={listBusy}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-3.5 w-3.5 opacity-85" />
              Refresh
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]"
          />
          {listError ? <div className="mt-2 text-xs text-red-600">{listError}</div> : null}
        </div>

        <div className="min-h-0 overflow-auto px-2 pb-4">
          <ul className="grid gap-1">
            {filtered.map((m) => {
              const active = mode === "edit" && id === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => void openMindmap(m.id)}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left transition",
                      active ? "bg-[hsl(var(--card2))] text-[hsl(var(--fg))]" : "hover:bg-[hsl(var(--card2))]",
                    ].join(" ")}
                  >
                    <div className="truncate text-sm font-medium tracking-tight">{m.meta?.title ?? m.id}</div>
                    <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                      {m.id}
                      {m.meta?.updated ? ` · ${m.meta.updated}` : ""}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {paging.nextAfter ? (
            <button
              type="button"
              onClick={() => void refreshList({ append: true })}
              disabled={listBusy}
              className="mt-3 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
            >
              Load more
            </button>
          ) : null}
        </div>
      </aside>

      <section className="min-h-0 min-w-0 bg-[hsl(var(--bg))]">
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold tracking-tight">{mode === "create" ? "New mindmap" : id}</div>
              {dirty ? <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">unsaved</span> : null}
            </div>
            {studio.me ? (
              <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                @{studio.me.user.login} · {studio.me.repo.fullName}@{studio.me.repo.branch}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === "edit" ? (
              <button
                type="button"
                onClick={() => void del()}
                disabled={!id || busy}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5 opacity-85" />
                Trash
              </button>
            ) : null}

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
              title="Save"
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              {mode === "create" ? "Publish" : "Save"}
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

        <div className="grid h-full min-h-0 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          <div className="card min-w-0 p-4">
            <div className="grid gap-3">
              <Field label="id">
                <input
                  value={id}
                  onChange={(e) => {
                    setDirty(true);
                    setId(e.target.value);
                  }}
                  className={inputClass}
                  placeholder="otel-context"
                  disabled={mode !== "create"}
                />
              </Field>
              <Field label="title (optional)">
                <input
                  value={title}
                  onChange={(e) => {
                    setDirty(true);
                    setTitle(e.target.value);
                  }}
                  className={inputClass}
                  placeholder="OTel Context"
                />
              </Field>
              <Field label="json">
                <textarea
                  value={json}
                  onChange={(e) => {
                    setDirty(true);
                    setJson(e.target.value);
                  }}
                  className={textareaClass}
                  rows={16}
                />
              </Field>
            </div>
          </div>

          <div className="card min-w-0 p-4">
            <div className="text-sm font-semibold tracking-tight">Preview</div>
            <div className="mt-2 text-sm text-[hsl(var(--muted))]">v0 keeps mindmaps as JSON; interactive graph UI can land in v1.</div>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] p-3 text-xs leading-5">
              {json.trim() ? json.trim() : "{}"}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium tracking-tight text-[hsl(var(--muted))]">{props.label}</span>
      {props.children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60";

const textareaClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-mono outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60";
