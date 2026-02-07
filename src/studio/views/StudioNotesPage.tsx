import { Check, ExternalLink, Eye, ImagePlus, PencilLine, Plus, RefreshCw, SplitSquareHorizontal, Trash2 } from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { publisherFetchJson, publisherUploadFile } from "../../ui/publisher/client";
import { useStudioState } from "../state/StudioState";

type NoteInput = {
  title: string;
  content: string;
  excerpt?: string;
  categories?: string[];
  tags?: string[];
  nodes?: string[];
  mindmaps?: string[];
  cover?: string;
  draft?: boolean;
  slug?: string;
  date?: string; // YYYY-MM-DD
  updated?: string; // YYYY-MM-DD
};

type NotesListResponse = {
  notes: Array<{
    id: string;
    path: string;
    sha: string;
    size: number;
    meta?: { title?: string; date?: string; updated?: string; draft?: boolean; excerpt?: string };
  }>;
  paging: { after: string | null; nextAfter: string | null };
};

type NoteGetResponse = {
  note: { id: string; path: string; input: NoteInput; markdown: string };
};

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseCsvList(input: string): string[] | undefined {
  const out = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

function toCsvList(input: string[] | undefined): string {
  if (!Array.isArray(input) || input.length === 0) return "";
  return input.join(", ");
}

type ViewMode = "edit" | "split" | "preview";

type EditorState = {
  mode: "create" | "edit";
  id: string | null;
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  categories: string;
  tags: string;
  nodes: string;
  mindmaps: string;
  cover: string;
  draft: boolean;
  content: string;
};

function emptyEditor(): EditorState {
  return {
    mode: "create",
    id: null,
    title: "",
    date: todayLocal(),
    slug: "",
    excerpt: "",
    categories: "",
    tags: "",
    nodes: "",
    mindmaps: "",
    cover: "",
    draft: false,
    content: "",
  };
}

function insertIntoTextarea(el: HTMLTextAreaElement, insert: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + insert + el.value.slice(end);
  el.value = next;
  const caret = start + insert.length;
  el.selectionStart = caret;
  el.selectionEnd = caret;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
}

export function StudioNotesPage() {
  const studio = useStudioState();

  const [viewMode, setViewMode] = React.useState<ViewMode>("split");

  const [notes, setNotes] = React.useState<NotesListResponse["notes"]>([]);
  const [paging, setPaging] = React.useState<NotesListResponse["paging"]>({ after: null, nextAfter: null });
  const [filter, setFilter] = React.useState("");
  const [listBusy, setListBusy] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [editor, setEditor] = React.useState<EditorState>(() => emptyEditor());
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);
  const [lastUploadUrl, setLastUploadUrl] = React.useState<string | null>(null);

  const contentRef = React.useRef<HTMLTextAreaElement | null>(null);

  const refreshList = React.useCallback(
    async (opts?: { append?: boolean }) => {
      if (!studio.token) return;
      setListBusy(true);
      setListError(null);
      try {
        const url = new URL("/api/admin/notes", "http://local");
        url.searchParams.set("include", "meta");
        url.searchParams.set("limit", "60");
        if (opts?.append && paging.nextAfter) url.searchParams.set("after", paging.nextAfter);
        const path = url.pathname + url.search;
        const res = await publisherFetchJson<NotesListResponse>({ path, token: studio.token });
        setNotes((prev) => (opts?.append ? [...prev, ...res.notes] : res.notes));
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

  const newNote = React.useCallback(() => {
    setEditor(emptyEditor());
    setDirty(false);
    setNotice(null);
    setCommitUrl(null);
    setLastUploadUrl(null);
    setTimeout(() => contentRef.current?.focus(), 0);
  }, []);

  const openNote = React.useCallback(
    async (id: string) => {
      if (!studio.token) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherFetchJson<NoteGetResponse>({ path: `/api/admin/notes/${encodeURIComponent(id)}`, token: studio.token });
        const input = res.note.input;
        setEditor({
          mode: "edit",
          id: res.note.id,
          title: input.title ?? res.note.id,
          date: input.date ?? todayLocal(),
          slug: input.slug ?? "",
          excerpt: input.excerpt ?? "",
          categories: toCsvList(input.categories),
          tags: toCsvList(input.tags),
          nodes: toCsvList(input.nodes),
          mindmaps: toCsvList(input.mindmaps),
          cover: input.cover ?? "",
          draft: Boolean(input.draft),
          content: input.content ?? "",
        });
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
    if (!editor.title.trim()) {
      setNotice("Missing title.");
      return;
    }
    if (!editor.content.trim()) {
      setNotice("Missing content.");
      return;
    }

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      if (editor.mode === "create") {
        const res = await publisherFetchJson<{
          note: { id: string; path: string };
          commit: { sha: string; url: string };
        }>({
          path: "/api/admin/notes",
          method: "POST",
          token: studio.token,
          body: {
            title: editor.title.trim(),
            slug: editor.slug.trim() || undefined,
            date: editor.date.trim() || undefined,
            excerpt: editor.excerpt.trim() || undefined,
            categories: parseCsvList(editor.categories),
            tags: parseCsvList(editor.tags),
            nodes: parseCsvList(editor.nodes),
            mindmaps: parseCsvList(editor.mindmaps),
            cover: editor.cover.trim() || undefined,
            draft: editor.draft,
            content: editor.content,
          } satisfies NoteInput,
        });

        setEditor((prev) => ({ ...prev, mode: "edit", id: res.note.id }));
        setNotice(`Published: ${res.note.id}`);
        setCommitUrl(res.commit.url);
        setDirty(false);
        void refreshList();
        return;
      }

      if (!editor.id) {
        setNotice("Missing note id.");
        return;
      }

      const res = await publisherFetchJson<{
        note: { id: string; path: string };
        commit: { sha: string; url: string };
      }>({
        path: `/api/admin/notes/${encodeURIComponent(editor.id)}`,
        method: "PATCH",
        token: studio.token,
        body: {
          title: editor.title.trim(),
          date: editor.date.trim() || undefined,
          excerpt: editor.excerpt.trim() || undefined,
          categories: parseCsvList(editor.categories),
          tags: parseCsvList(editor.tags),
          nodes: parseCsvList(editor.nodes),
          mindmaps: parseCsvList(editor.mindmaps),
          cover: editor.cover.trim() || undefined,
          draft: editor.draft,
          content: editor.content,
        } satisfies Partial<NoteInput>,
      });
      setNotice(`Saved: ${res.note.id}`);
      setCommitUrl(res.commit.url);
      setDirty(false);
      void refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Save failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, editor, refreshList]);

  const del = React.useCallback(async () => {
    if (!studio.token || !editor.id) return;
    const ok = window.confirm(`Trash note ${editor.id}?`);
    if (!ok) return;
    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<{ ok: true; commit: { sha: string; url: string } }>({
        path: `/api/admin/notes/${encodeURIComponent(editor.id)}`,
        method: "DELETE",
        token: studio.token,
      });
      setNotice("Trashed.");
      setCommitUrl(res.commit.url);
      setDirty(false);
      newNote();
      void refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Delete failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [studio.token, editor.id, newNote, refreshList]);

  const uploadImage = React.useCallback(
    async (file: File) => {
      if (!studio.token) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherUploadFile({ token: studio.token, file });
        setCommitUrl(res.commit.url);
        setLastUploadUrl(res.asset.url);
        setNotice(`Uploaded: ${res.asset.url}`);
        setEditor((prev) => ({ ...prev, cover: prev.cover.trim() ? prev.cover : res.asset.url }));

        const insert = `\n\n![](${res.asset.url})\n`;
        const el = contentRef.current;
        if (el) insertIntoTextarea(el, insert);
        else setEditor((prev) => ({ ...prev, content: prev.content ? prev.content + insert : insert.trimStart() }));
        setDirty(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(`Upload failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [studio.token],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;
      e.preventDefault();
      void save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const t = (n.meta?.title ?? "").toLowerCase();
      return n.id.toLowerCase().includes(q) || t.includes(q);
    });
  }, [notes, filter]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
      <aside className="min-h-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">LIBRARY</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={newNote}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
              title="New note"
            >
              <Plus className="h-3.5 w-3.5 opacity-85" />
              New
            </button>
            <button
              type="button"
              onClick={() => void refreshList()}
              disabled={listBusy}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))] disabled:cursor-not-allowed"
              title="Refresh list"
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
            placeholder="Search by id or title…"
            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]"
          />
          {listError ? <div className="mt-2 text-xs text-red-600">{listError}</div> : null}
        </div>

        <div className="min-h-0 overflow-auto px-2 pb-4">
          <ul className="grid gap-1">
            {filtered.map((n) => {
              const active = editor.id === n.id;
              const title = n.meta?.title ?? n.id;
              const sub = [n.meta?.date, n.meta?.draft ? "draft" : null].filter(Boolean).join(" · ");
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openNote(n.id)}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left transition",
                      active ? "bg-[hsl(var(--card2))] text-[hsl(var(--fg))]" : "hover:bg-[hsl(var(--card2))]",
                    ].join(" ")}
                  >
                    <div className="truncate text-sm font-medium tracking-tight">{title}</div>
                    <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">{sub || n.id}</div>
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

      <section className="min-h-0 min-w-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold tracking-tight">{editor.mode === "create" ? "New note" : editor.id}</div>
              {dirty ? <span className="rounded-full bg-[hsl(var(--card2))] px-2 py-0.5 text-[10px] font-medium">unsaved</span> : null}
            </div>
            {studio.me ? (
              <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                @{studio.me.user.login} · {studio.me.repo.fullName}@{studio.me.repo.branch}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              <IconToggle active={viewMode === "edit"} onClick={() => setViewMode("edit")} title="Edit">
                <PencilLine className="h-4 w-4" />
              </IconToggle>
              <IconToggle active={viewMode === "split"} onClick={() => setViewMode("split")} title="Split">
                <SplitSquareHorizontal className="h-4 w-4" />
              </IconToggle>
              <IconToggle active={viewMode === "preview"} onClick={() => setViewMode("preview")} title="Preview">
                <Eye className="h-4 w-4" />
              </IconToggle>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]">
              <ImagePlus className="h-3.5 w-3.5 opacity-85" />
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadImage(f);
                  e.currentTarget.value = "";
                }}
                disabled={!studio.token || busy}
              />
            </label>

            {editor.mode === "edit" ? (
              <button
                type="button"
                onClick={() => void del()}
                disabled={!editor.id || busy}
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
              title="Save (⌘S / Ctrl+S)"
            >
              <Check className="h-3.5 w-3.5 opacity-85" />
              {editor.mode === "create" ? "Publish" : "Save"}
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

        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {viewMode !== "preview" ? (
            <div className="min-h-0 border-b border-[hsl(var(--border))] lg:border-b-0 lg:border-r">
              <textarea
                ref={contentRef}
                value={editor.content}
                onChange={(e) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, content: e.target.value }));
                }}
                className="h-full w-full resize-none bg-[hsl(var(--bg))] px-4 py-4 font-mono text-sm leading-6 outline-none placeholder:text-[hsl(var(--muted))]"
                placeholder="## Write…"
              />
            </div>
          ) : null}

          {viewMode !== "edit" ? (
            <div className="min-h-0 overflow-auto bg-[hsl(var(--card))] px-4 py-4">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{editor.content || ""}</ReactMarkdown>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-auto bg-[hsl(var(--card))] lg:block">
        <div className="border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="text-xs font-semibold tracking-wide text-[hsl(var(--muted))]">METADATA</div>
        </div>

        <div className="grid gap-4 px-4 py-4">
          <Field label="Title">
            <input
              value={editor.title}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, title: e.target.value }));
              }}
              className={inputClass}
              placeholder="A sharp title"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <input
                value={editor.date}
                onChange={(e) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, date: e.target.value }));
                }}
                className={inputClass}
                placeholder="YYYY-MM-DD"
              />
            </Field>
            <Field label="Slug (create only)">
              <input
                value={editor.slug}
                onChange={(e) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, slug: e.target.value }));
                }}
                className={inputClass}
                placeholder="otel-context"
                disabled={editor.mode !== "create"}
              />
            </Field>
          </div>

          <Field label="Excerpt">
            <textarea
              value={editor.excerpt}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, excerpt: e.target.value }));
              }}
              className={textareaClass}
              rows={3}
              placeholder="One-line intent, for cards / index."
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categories (comma)">
              <input
                value={editor.categories}
                onChange={(e) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, categories: e.target.value }));
                }}
                className={inputClass}
                placeholder="observability, ai-infra"
              />
            </Field>
            <Field label="Tags (comma)">
              <input
                value={editor.tags}
                onChange={(e) => {
                  setDirty(true);
                  setEditor((prev) => ({ ...prev, tags: e.target.value }));
                }}
                className={inputClass}
                placeholder="otel, tracing"
              />
            </Field>
          </div>

          <Field label="Roadmap nodes (comma)">
            <input
              value={editor.nodes}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, nodes: e.target.value }));
              }}
              className={inputClass}
              placeholder="ai-infra/otel, ai-infra/k8s"
            />
          </Field>

          <Field label="Mindmaps (comma)">
            <input
              value={editor.mindmaps}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, mindmaps: e.target.value }));
              }}
              className={inputClass}
              placeholder="otel-context"
            />
          </Field>

          <Field label="Cover URL">
            <input
              value={editor.cover}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, cover: e.target.value }));
              }}
              className={inputClass}
              placeholder="/uploads/…"
            />
          </Field>

          <label className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-sm">
            <span className="text-sm">Draft</span>
            <input
              type="checkbox"
              checked={editor.draft}
              onChange={(e) => {
                setDirty(true);
                setEditor((prev) => ({ ...prev, draft: e.target.checked }));
              }}
            />
          </label>

          {lastUploadUrl ? (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-2 text-xs text-[hsl(var(--muted))]">
              Last upload: <code className="break-all">{lastUploadUrl}</code>
            </div>
          ) : null}
        </div>
      </aside>
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

function IconToggle(props: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "inline-flex items-center justify-center rounded-full border px-2.5 py-2 transition",
        props.active
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_45%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_10%,hsl(var(--card)))] text-[hsl(var(--fg))]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted))] hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]",
      ].join(" ")}
      title={props.title}
    >
      {props.children}
    </button>
  );
}

const inputClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60";

const textareaClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60";
