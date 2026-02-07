import { Check, ExternalLink, ImagePlus, LogIn, LogOut, PencilLine } from "lucide-react";
import React from "react";
import { publisherFetchJson, publisherUploadFile } from "../publisher/client";
import { PUBLISHER_BASE_URL } from "../publisher/config";
import { publisherToken } from "../publisher/storage";

type MeResponse = {
  user: { id: number; login: string; avatarUrl: string | null };
  repo: { fullName: string; branch: string };
};

function parseCsvList(input: string): string[] | undefined {
  const out = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PublisherPage() {
  const [token, setToken] = React.useState<string | null>(() => publisherToken.get());
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [meError, setMeError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [date, setDate] = React.useState(() => todayLocal());
  const [excerpt, setExcerpt] = React.useState("");
  const [categories, setCategories] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [nodes, setNodes] = React.useState("");
  const [mindmaps, setMindmaps] = React.useState("");
  const [cover, setCover] = React.useState("");
  const [draft, setDraft] = React.useState(false);
  const [content, setContent] = React.useState("");

  const [mindmapId, setMindmapId] = React.useState("");
  const [mindmapTitle, setMindmapTitle] = React.useState("");
  const [mindmapJson, setMindmapJson] = React.useState(`{\n  "nodes": [],\n  "edges": [],\n  "viewport": { "x": 0, "y": 0, "zoom": 1 }\n}`);

  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [commitUrl, setCommitUrl] = React.useState<string | null>(null);

  const contentRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!token) {
      setMe(null);
      setMeError(null);
      return;
    }

    setMeError(null);
    publisherFetchJson<MeResponse>({ path: "/api/auth/me", token })
      .then((r) => {
        if (cancelled) return;
        setMe(r);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setMeError(msg);
        setMe(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = React.useCallback(() => {
    const redirect = new URL("/auth/callback", window.location.origin).toString();
    const url = new URL("/api/auth/github/start", PUBLISHER_BASE_URL);
    url.searchParams.set("redirect", redirect);
    window.location.assign(url.toString());
  }, []);

  const logout = React.useCallback(() => {
    publisherToken.clear();
    setToken(null);
    setMe(null);
    setMeError(null);
    setCommitUrl(null);
    setNotice("Signed out.");
  }, []);

  const publishNote = React.useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const res = await publisherFetchJson<{
        note: { id: string; path: string };
        commit: { sha: string; url: string };
      }>({
        path: "/api/admin/notes",
        method: "POST",
        token,
        body: {
          title: title.trim(),
          slug: slug.trim() || undefined,
          date: date.trim() || undefined,
          excerpt: excerpt.trim() || undefined,
          categories: parseCsvList(categories),
          tags: parseCsvList(tags),
          nodes: parseCsvList(nodes),
          mindmaps: parseCsvList(mindmaps),
          cover: cover.trim() || undefined,
          draft,
          content,
        },
      });
      setNotice(`Published: ${res.note.id}`);
      setCommitUrl(res.commit.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Publish failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [token, title, slug, date, excerpt, categories, tags, nodes, mindmaps, cover, draft, content]);

  const publishMindmap = React.useCallback(async () => {
    if (!token) return;
    const id = mindmapId.trim();
    if (!id) {
      setNotice("Mindmap failed: missing id");
      return;
    }

    setBusy(true);
    setNotice(null);
    setCommitUrl(null);
    try {
      const parsed = (mindmapJson.trim() ? JSON.parse(mindmapJson) : {}) as Record<string, unknown>;
      const res = await publisherFetchJson<{
        mindmap: { id: string; path: string };
        commit: { sha: string; url: string };
      }>({
        path: "/api/admin/mindmaps",
        method: "POST",
        token,
        body: {
          id,
          title: mindmapTitle.trim() || undefined,
          format: typeof parsed.format === "string" ? parsed.format : undefined,
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : undefined,
          edges: Array.isArray(parsed.edges) ? parsed.edges : undefined,
          viewport: parsed.viewport ?? undefined,
        },
      });
      setNotice(`Mindmap published: ${res.mindmap.id}`);
      setCommitUrl(res.commit.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Mindmap failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [token, mindmapId, mindmapTitle, mindmapJson]);

  const uploadImage = React.useCallback(
    async (file: File) => {
      if (!token) return;
      setBusy(true);
      setNotice(null);
      setCommitUrl(null);
      try {
        const res = await publisherUploadFile({ token, file });
        setCommitUrl(res.commit.url);
        setNotice(`Uploaded: ${res.asset.url}`);
        setCover((prev) => (prev.trim() ? prev : res.asset.url));

        const md = `\n\n![](${res.asset.url})\n`;
        setContent((prev) => (prev ? `${prev}${md}` : md.trimStart()));
        setTimeout(() => contentRef.current?.focus(), 0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(`Upload failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <PencilLine className="h-4 w-4 opacity-85" />
            Studio
          </div>
          <div className="mt-1 text-sm text-[hsl(var(--muted))]">
            Publish notes & assets to your GitHub Pages repo via Publisher API.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {token ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
            >
              <LogOut className="h-4 w-4 opacity-85" />
              Logout
            </button>
          ) : (
            <button
              type="button"
              onClick={login}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
            >
              <LogIn className="h-4 w-4 opacity-85" />
              Login with GitHub
            </button>
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium tracking-tight">Session</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">
              Publisher:{" "}
              <a
                className="border-b border-[color-mix(in_oklab,hsl(var(--accent))_45%,transparent)] hover:border-[hsl(var(--accent))]"
                href={PUBLISHER_BASE_URL}
                target="_blank"
                rel="noreferrer"
              >
                {PUBLISHER_BASE_URL}
              </a>
            </div>
            {token ? (
              <div className="mt-3 text-sm">
                {me ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card2))] px-3 py-1.5 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
                      @{me.user.login}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted))]">
                      {me.repo.fullName} · {me.repo.branch}
                    </span>
                  </div>
                ) : meError ? (
                  <div className="mt-2 text-xs text-red-600">Auth error: {meError}</div>
                ) : (
                  <div className="mt-2 text-xs text-[hsl(var(--muted))]">Checking…</div>
                )}
              </div>
            ) : (
              <div className="mt-3 text-xs text-[hsl(var(--muted))]">Not logged in.</div>
            )}
          </div>

          {notice ? (
            <div className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card2))] p-4 text-sm lg:max-w-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                  <Check className="h-3.5 w-3.5 opacity-85" />
                </span>
                <div className="min-w-0">
                  <div className="break-words">{notice}</div>
                  {commitUrl ? (
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
                    >
                      View commit <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="card min-w-0 p-6">
          <div className="text-sm font-semibold tracking-tight">New note</div>
          <div className="mt-1 text-sm text-[hsl(var(--muted))]">One content type. No long/short distinction.</div>

          <div className="mt-6 grid gap-4">
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="A sharp title"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date">
                <input value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Slug (optional)">
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} placeholder="otel-context" />
              </Field>
            </div>

            <Field label="Excerpt (optional)">
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className={textareaClass}
                rows={2}
                placeholder="What is this note about?"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categories (comma)">
                <input
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                  className={inputClass}
                  placeholder="observability, ai-infra"
                />
              </Field>
              <Field label="Tags (comma)">
                <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="otel, tracing" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Roadmap nodes (comma)">
                <input
                  value={nodes}
                  onChange={(e) => setNodes(e.target.value)}
                  className={inputClass}
                  placeholder="ai-infra/otel, ai-infra/k8s"
                />
              </Field>
              <Field label="Mindmaps (comma)">
                <input value={mindmaps} onChange={(e) => setMindmaps(e.target.value)} className={inputClass} placeholder="otel-context" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cover URL (optional)">
                <input value={cover} onChange={(e) => setCover(e.target.value)} className={inputClass} placeholder="/uploads/..." />
              </Field>
              <Field label="Visibility">
                <label className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm">
                  <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
                  Draft
                </label>
              </Field>
            </div>

            <Field label="Content (Markdown)">
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={textareaClass}
                rows={16}
                placeholder="## Write…"
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]">
                  <ImagePlus className="h-4 w-4 opacity-85" />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadImage(f);
                      e.currentTarget.value = "";
                    }}
                    disabled={!token || busy}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => void publishNote()}
                disabled={!token || busy}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                  !token || busy
                    ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                    : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]",
                ].join(" ")}
              >
                <Check className="h-4 w-4 opacity-85" />
                Publish
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="card p-6">
            <div className="text-sm font-semibold tracking-tight">Tips</div>
            <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm text-[hsl(var(--muted))]">
              <li>
                Nodes use the format <code>roadmapId/nodeId</code>, e.g. <code>ai-infra/otel</code>.
              </li>
              <li>
                Uploaded assets are committed to <code>public/uploads/</code> and referenced via <code>/uploads/…</code>.
              </li>
              <li>
                If you publish to a remote repo, pull locally to see changes in this dev UI.
              </li>
            </ul>
          </div>

          <div className="card p-6">
            <div className="text-sm font-semibold tracking-tight">Mindmap</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">Optional: store ReactFlow JSON in the repo.</div>

            <div className="mt-5 grid gap-4">
              <Field label="Mindmap id">
                <input
                  value={mindmapId}
                  onChange={(e) => setMindmapId(e.target.value)}
                  className={inputClass}
                  placeholder="otel-context"
                />
              </Field>
              <Field label="Title (optional)">
                <input
                  value={mindmapTitle}
                  onChange={(e) => setMindmapTitle(e.target.value)}
                  className={inputClass}
                  placeholder="OTel Context"
                />
              </Field>
              <Field label="JSON payload">
                <textarea
                  value={mindmapJson}
                  onChange={(e) => setMindmapJson(e.target.value)}
                  className={textareaClass}
                  rows={10}
                />
              </Field>

              <button
                type="button"
                onClick={() => void publishMindmap()}
                disabled={!token || busy}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                  !token || busy
                    ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                    : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_18%,hsl(var(--card)))]",
                ].join(" ")}
              >
                <Check className="h-4 w-4 opacity-85" />
                Publish mindmap
              </button>
            </div>
          </div>
        </div>
      </div>
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
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]";

const textareaClass =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none placeholder:text-[hsl(var(--muted))] focus:border-[hsl(var(--accent))]";
