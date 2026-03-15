import {
  ArrowUpRight,
  CircleAlert,
  CloudDownload,
  FileDiff,
  FileText,
  Image,
  LogIn,
  LogOut,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { StudioStateProvider, useStudioState } from "../state/StudioState";
import { StudioWorkspaceProvider, useStudioWorkspace } from "../state/StudioWorkspace";

type StudioSectionKey = "changes" | "notes" | "assets" | "config";

type StudioSectionMeta = {
  key: StudioSectionKey;
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type StudioNavItem = StudioSectionMeta & {
  badge: number | null;
};

const STUDIO_SECTIONS: StudioSectionMeta[] = [
  {
    key: "changes",
    to: "/studio/changes",
    label: "Changes",
    description: "Review everything staged locally before publishing.",
    icon: FileDiff,
  },
  {
    key: "notes",
    to: "/studio/notes",
    label: "Notes",
    description: "Write, edit, and recover note drafts.",
    icon: FileText,
  },
  {
    key: "assets",
    to: "/studio/assets",
    label: "Assets",
    description: "Manage uploads and deletions under public uploads.",
    icon: Image,
  },
  {
    key: "config",
    to: "/studio/config",
    label: "Config",
    description: "Edit site profile and category sources.",
    icon: Settings,
  },
];

export function StudioShell() {
  return (
    <StudioStateProvider>
      <StudioWorkspaceProvider>
        <StudioLayout />
      </StudioWorkspaceProvider>
    </StudioStateProvider>
  );
}

function sectionFromPath(pathname: string): StudioSectionMeta {
  if (pathname.startsWith("/studio/assets")) return STUDIO_SECTIONS[2]!;
  if (pathname.startsWith("/studio/config")) return STUDIO_SECTIONS[3]!;
  if (pathname.startsWith("/studio/changes")) return STUDIO_SECTIONS[0]!;
  return STUDIO_SECTIONS[1]!;
}

function StudioLayout() {
  const location = useLocation();
  const studio = useStudioState();
  const ws = useStudioWorkspace();
  const currentSection = sectionFromPath(location.pathname);
  const repo = studio.me?.repo ?? null;
  const user = studio.me?.user ?? null;
  const assetOps = ws.stats.assetsUploads + ws.stats.assetsDeletes;
  const currentPath = location.pathname + location.search + location.hash;

  const navItems: StudioNavItem[] = React.useMemo(
    () => [
      { ...STUDIO_SECTIONS[0]!, badge: ws.stats.total || null },
      { ...STUDIO_SECTIONS[1]!, badge: ws.stats.notes || null },
      { ...STUDIO_SECTIONS[2]!, badge: assetOps || null },
      { ...STUDIO_SECTIONS[3]!, badge: ws.stats.config || null },
    ],
    [assetOps, ws.stats.config, ws.stats.notes, ws.stats.total],
  );

  const notice = ws.publishError
    ? {
        tone: "error" as const,
        title: ws.publishError.code === "HEAD_MOVED" ? "Remote changed" : "Publish failed",
        message: ws.publishError.message,
      }
    : studio.meError
      ? {
          tone: "warning" as const,
          title: "Session needs attention",
          message: studio.meError,
        }
      : null;

  return (
    <div className="grid h-dvh grid-cols-1 bg-[hsl(var(--bg))] text-[hsl(var(--fg))] lg:grid-cols-[264px_minmax(0,1fr)]">
      <StudioSidebar
        currentSection={currentSection}
        navItems={navItems}
        hasToken={Boolean(studio.token)}
        onLogin={() => studio.login(currentPath)}
        repo={repo}
        stagedTotal={ws.stats.total}
        user={user}
      />

      <div className="min-h-0 flex flex-col">
        {studio.token ? (
          <>
            <StudioTopbar
              assetOps={assetOps}
              currentSection={currentSection}
              lastCommitUrl={ws.lastCommitUrl}
              navItems={navItems}
              notice={notice}
              publishing={ws.publishing}
              repo={repo}
              stagedTotal={ws.stats.total}
              stats={ws.stats}
              onLogout={studio.logout}
              onPublish={() => void ws.publishAll({ confirm: true })}
              onSync={studio.forceSync}
            />

            <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3 md:px-4 md:pb-4 lg:px-5 lg:pb-5">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-[color:var(--border-soft)] bg-[hsl(var(--card))]">
                <Outlet />
              </div>
            </div>
          </>
        ) : (
          <StudioSignInScreen onLogin={() => studio.login(currentPath)} />
        )}
      </div>
    </div>
  );
}

function StudioSidebar(props: {
  currentSection: StudioSectionMeta;
  navItems: StudioNavItem[];
  hasToken: boolean;
  onLogin: () => void;
  repo: { fullName: string; branch: string; headSha: string } | null;
  stagedTotal: number;
  user: { login: string; avatarUrl: string | null } | null;
}) {
  return (
    <aside className="hidden min-h-0 flex-col border-r border-[color:var(--border-soft)] bg-[hsl(var(--card))] lg:flex">
      <div className="border-b border-[color:var(--border-soft)] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[hsl(var(--card2))]">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--muted))]">Hyperblog</div>
            <div className="truncate text-lg font-semibold tracking-tight">Studio</div>
          </div>
        </div>
        {props.repo ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <SidebarPill>{props.repo.branch}</SidebarPill>
            <SidebarPill>{props.repo.headSha.slice(0, 7)}</SidebarPill>
            <SidebarPill accent={props.stagedTotal > 0}>{props.stagedTotal} staged</SidebarPill>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        <nav className="grid gap-1.5">
          {props.navItems.map((item) => (
            <SidebarNavItem key={item.key} active={item.key === props.currentSection.key} item={item} />
          ))}
        </nav>
      </div>

      <div className="border-t border-[color:var(--border-soft)] px-4 py-4">
        {props.hasToken && props.user ? (
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[hsl(var(--card2))] p-3">
            <div className="flex items-center gap-3">
              {props.user.avatarUrl ? (
                <img src={props.user.avatarUrl} alt={props.user.login} className="h-9 w-9 rounded-xl object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-[hsl(var(--card))] text-[hsl(var(--muted))]">
                  <UserRound className="h-4.5 w-4.5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium tracking-tight">@{props.user.login}</div>
                <div className="mt-0.5 truncate text-xs text-[hsl(var(--muted))]">
                  {props.repo ? props.repo.fullName : "Publisher session"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[hsl(var(--card2))] p-3">
            <div className="text-sm font-medium tracking-tight">Login required</div>
            <div className="mt-1 text-xs leading-6 text-[hsl(var(--muted))]">Sign in to sync and publish from Studio.</div>
            <button
              type="button"
              onClick={props.onLogin}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--fg))] transition hover:bg-[hsl(var(--card2))]"
            >
              <LogIn className="h-4 w-4 opacity-85" />
              Login with GitHub
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarNavItem(props: { active: boolean; item: StudioNavItem }) {
  const Icon = props.item.icon;
  return (
    <NavLink
      to={props.item.to}
      className={[
        "rounded-[18px] border px-3 py-3 transition",
        props.active
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_28%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_8%,hsl(var(--card)))]"
          : "border-transparent hover:border-[color:var(--border-soft)] hover:bg-[hsl(var(--card2))]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            props.active
              ? "border-[color-mix(in_oklab,hsl(var(--accent))_20%,hsl(var(--border)))] bg-[hsl(var(--card))]"
              : "border-[color:var(--border-soft)] bg-[hsl(var(--card))] text-[hsl(var(--muted))]",
          ].join(" ")}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-sm font-medium tracking-tight">{props.item.label}</div>
            {props.item.badge ? <NavBadge value={props.item.badge} active={props.active} /> : null}
          </div>
          <div className="mt-1 text-xs leading-6 text-[hsl(var(--muted))]">{props.item.description}</div>
        </div>
      </div>
    </NavLink>
  );
}

function StudioTopbar(props: {
  assetOps: number;
  currentSection: StudioSectionMeta;
  lastCommitUrl: string | null;
  navItems: StudioNavItem[];
  notice: { tone: "warning" | "error"; title: string; message: string } | null;
  publishing: boolean;
  repo: { fullName: string; branch: string; headSha: string } | null;
  stagedTotal: number;
  stats: { total: number; notes: number; config: number };
  onLogout: () => void;
  onPublish: () => void;
  onSync: () => void;
}) {
  const SectionIcon = props.currentSection.icon;

  return (
    <header className="border-b border-[color:var(--border-soft)] bg-[hsl(var(--bg))]">
      <div className="px-3 py-4 md:px-4 lg:px-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-[hsl(var(--card))]">
                  <SectionIcon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">{props.currentSection.label}</h1>
                  <p className="mt-1 text-sm text-[hsl(var(--muted))]">{props.currentSection.description}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {props.lastCommitUrl ? (
                <a
                  href={props.lastCommitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
                >
                  Latest commit
                </a>
              ) : null}
              <button
                type="button"
                onClick={props.onPublish}
                disabled={!props.stagedTotal || props.publishing}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition",
                  !props.stagedTotal || props.publishing
                    ? "cursor-not-allowed border border-[hsl(var(--border))] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]"
                    : "border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_10%,hsl(var(--card)))] text-[hsl(var(--fg))] hover:bg-[color-mix(in_oklab,hsl(var(--accent))_16%,hsl(var(--card)))]",
                ].join(" ")}
              >
                <ArrowUpRight className="h-4 w-4 opacity-85" />
                {props.publishing ? "Publishing…" : props.stagedTotal ? `Publish ${props.stagedTotal}` : "Publish"}
              </button>
              <button
                type="button"
                onClick={props.onSync}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
              >
                <CloudDownload className="h-4 w-4 opacity-85" />
                Sync
              </button>
              <button
                type="button"
                onClick={props.onLogout}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--muted))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
              >
                <LogOut className="h-4 w-4 opacity-85" />
                Logout
              </button>
            </div>
          </div>

          {props.notice ? <ShellNotice notice={props.notice} /> : null}

          <div className="flex flex-wrap gap-2">
            <TopStatusPill label="Staged" value={String(props.stats.total)} accent={props.stats.total > 0} />
            <TopStatusPill label="Notes" value={String(props.stats.notes)} />
            <TopStatusPill label="Config" value={String(props.stats.config)} />
            <TopStatusPill label="Assets" value={String(props.assetOps)} />
            {props.repo ? <TopStatusPill label="Branch" value={props.repo.branch} /> : null}
          </div>

          <div className="lg:hidden">
            <nav className="flex min-w-max items-center gap-2 overflow-x-auto pb-1">
              {props.navItems.map((item) => (
                <MobileNavItem key={item.key} active={item.key === props.currentSection.key} item={item} />
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

function StudioSignInScreen(props: { onLogin: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-[24px] border border-[color:var(--border-soft)] bg-[hsl(var(--card))] p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[hsl(var(--card2))]">
          <LogIn className="h-4.5 w-4.5" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in to Studio</h1>
        <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted))]">
          Use GitHub OAuth to load repository state, edit drafts locally, and publish staged changes.
        </p>
        <div className="mt-5 grid gap-2 text-sm text-[hsl(var(--muted))]">
          <div>Local-first drafts</div>
          <div>One review queue</div>
          <div>Single commit publish</div>
        </div>
        <button
          type="button"
          onClick={props.onLogin}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color-mix(in_oklab,hsl(var(--accent))_55%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_10%,hsl(var(--card)))] px-4 py-3 text-sm font-medium text-[hsl(var(--fg))] transition hover:bg-[color-mix(in_oklab,hsl(var(--accent))_16%,hsl(var(--card)))]"
        >
          <LogIn className="h-4 w-4 opacity-85" />
          Login with GitHub
        </button>
      </div>
    </div>
  );
}

function ShellNotice(props: { notice: { tone: "warning" | "error"; title: string; message: string } }) {
  return (
    <div
      className={[
        "rounded-[18px] border px-4 py-3",
        props.notice.tone === "error"
          ? "border-[color-mix(in_oklab,red_36%,hsl(var(--border)))] bg-[color-mix(in_oklab,red_7%,hsl(var(--card)))] text-red-700"
          : "border-[color-mix(in_oklab,orange_36%,hsl(var(--border)))] bg-[color-mix(in_oklab,orange_7%,hsl(var(--card)))] text-[hsl(var(--fg))]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,currentColor_10%,transparent)]">
          <CircleAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium tracking-tight">{props.notice.title}</div>
          <div className="mt-1 text-sm leading-relaxed opacity-90">{props.notice.message}</div>
        </div>
      </div>
    </div>
  );
}

function MobileNavItem(props: { active: boolean; item: StudioNavItem }) {
  const Icon = props.item.icon;
  return (
    <NavLink
      to={props.item.to}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
        props.active
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_28%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_8%,hsl(var(--card)))] text-[hsl(var(--fg))]"
          : "border-[color:var(--border-soft)] bg-[hsl(var(--card))] text-[hsl(var(--muted))]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 opacity-85" />
      <span>{props.item.label}</span>
      {props.item.badge ? <NavBadge value={props.item.badge} active={props.active} /> : null}
    </NavLink>
  );
}

function TopStatusPill(props: { label: string; value: string; accent?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        props.accent
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_26%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_8%,hsl(var(--card)))] text-[hsl(var(--fg))]"
          : "border-[color:var(--border-soft)] bg-[hsl(var(--card))] text-[hsl(var(--muted))]",
      ].join(" ")}
    >
      <span className="font-semibold uppercase tracking-[0.18em]">{props.label}</span>
      <span className="text-[hsl(var(--fg))]">{props.value}</span>
    </span>
  );
}

function SidebarPill(props: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]",
        props.accent
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_26%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--accent))_8%,hsl(var(--card)))] text-[hsl(var(--fg))]"
          : "border-[color:var(--border-soft)] bg-[hsl(var(--card2))] text-[hsl(var(--muted))]",
      ].join(" ")}
    >
      {props.children}
    </span>
  );
}

function NavBadge(props: { value: number; active?: boolean }) {
  return (
    <span
      className={[
        "inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-tight",
        props.active
          ? "border-[color-mix(in_oklab,hsl(var(--accent))_24%,hsl(var(--border)))] bg-[hsl(var(--card))] text-[hsl(var(--fg))]"
          : "border-[color:var(--border-soft)] bg-[hsl(var(--card))] text-[hsl(var(--muted))]",
      ].join(" ")}
    >
      {props.value}
    </span>
  );
}
