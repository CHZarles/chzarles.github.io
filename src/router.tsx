import React from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./ui/shell/AppShell";
import { ErrorPage } from "./ui/views/ErrorPage";
import { HomePage } from "./ui/views/HomePage";
import { NotFoundPage } from "./ui/views/NotFoundPage";

function PageLoader(props: { label: string; tone?: "card" | "plain" }) {
  const cls =
    props.tone === "card"
      ? "card p-8 text-sm text-[hsl(var(--muted))]"
      : "p-4 text-sm text-[hsl(var(--muted))]";
  return <div className={cls}>{props.label}</div>;
}

function Lazy(props: { label: string; tone?: "card" | "plain"; children: React.ReactNode }) {
  return <React.Suspense fallback={<PageLoader label={props.label} tone={props.tone} />}>{props.children}</React.Suspense>;
}

const AuthCallbackPageLazy = React.lazy(() =>
  import("./ui/views/AuthCallbackPage").then((m) => ({ default: m.AuthCallbackPage })),
);
const NotesPageLazy = React.lazy(() => import("./ui/views/NotesPage").then((m) => ({ default: m.NotesPage })));
const NotePageLazy = React.lazy(() => import("./ui/views/NotePage").then((m) => ({ default: m.NotePage })));
const CategoriesPageLazy = React.lazy(() => import("./ui/views/CategoriesPage").then((m) => ({ default: m.CategoriesPage })));
const CategoryPageLazy = React.lazy(() => import("./ui/views/CategoryPage").then((m) => ({ default: m.CategoryPage })));
const MindmapsPageLazy = React.lazy(() => import("./ui/views/MindmapsPage").then((m) => ({ default: m.MindmapsPage })));
const MindmapPageLazy = React.lazy(() => import("./ui/views/MindmapPage").then((m) => ({ default: m.MindmapPage })));
const RoadmapsPageLazy = React.lazy(() => import("./ui/views/RoadmapsPage").then((m) => ({ default: m.RoadmapsPage })));
const RoadmapPageLazy = React.lazy(() => import("./ui/views/RoadmapPage").then((m) => ({ default: m.RoadmapPage })));
const RoadmapNodePageLazy = React.lazy(() => import("./ui/views/RoadmapNodePage").then((m) => ({ default: m.RoadmapNodePage })));
const ProjectsPageLazy = React.lazy(() => import("./ui/views/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const ProjectPageLazy = React.lazy(() => import("./ui/views/ProjectPage").then((m) => ({ default: m.ProjectPage })));

const StudioShellLazy = React.lazy(() => import("./studio/shell/StudioShell").then((m) => ({ default: m.StudioShell })));
const StudioNotesPageLazy = React.lazy(() => import("./studio/views/StudioNotesPage").then((m) => ({ default: m.StudioNotesPage })));
const StudioChangesPageLazy = React.lazy(() =>
  import("./studio/views/StudioChangesPage").then((m) => ({ default: m.StudioChangesPage })),
);
const StudioAssetsPageLazy = React.lazy(() =>
  import("./studio/views/StudioAssetsPage").then((m) => ({ default: m.StudioAssetsPage })),
);
const StudioRoadmapsPageLazy = React.lazy(() =>
  import("./studio/views/StudioRoadmapsPage").then((m) => ({ default: m.StudioRoadmapsPage })),
);
const StudioMindmapsPageLazy = React.lazy(() =>
  import("./studio/views/StudioMindmapsPage").then((m) => ({ default: m.StudioMindmapsPage })),
);
const StudioConfigPageLazy = React.lazy(() =>
  import("./studio/views/StudioConfigPage").then((m) => ({ default: m.StudioConfigPage })),
);
const StudioNotFoundPageLazy = React.lazy(() =>
  import("./studio/views/StudioNotFoundPage").then((m) => ({ default: m.StudioNotFoundPage })),
);

export const router = createBrowserRouter([
  {
    path: "/studio",
    element: (
      <Lazy label="Loading Studio…" tone="plain">
        <StudioShellLazy />
      </Lazy>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/studio/notes" replace /> },
      {
        path: "changes",
        element: (
          <Lazy label="Loading changes…" tone="plain">
            <StudioChangesPageLazy />
          </Lazy>
        ),
      },
      {
        path: "notes",
        element: (
          <Lazy label="Loading editor…" tone="plain">
            <StudioNotesPageLazy />
          </Lazy>
        ),
      },
      {
        path: "mindmaps",
        element: (
          <Lazy label="Loading mindmap editor…" tone="plain">
            <StudioMindmapsPageLazy />
          </Lazy>
        ),
      },
      {
        path: "assets",
        element: (
          <Lazy label="Loading assets…" tone="plain">
            <StudioAssetsPageLazy />
          </Lazy>
        ),
      },
      {
        path: "roadmaps",
        element: (
          <Lazy label="Loading roadmaps…" tone="plain">
            <StudioRoadmapsPageLazy />
          </Lazy>
        ),
      },
      {
        path: "config",
        element: (
          <Lazy label="Loading config…" tone="plain">
            <StudioConfigPageLazy />
          </Lazy>
        ),
      },
      {
        path: "*",
        element: (
          <Lazy label="Loading…" tone="plain">
            <StudioNotFoundPageLazy />
          </Lazy>
        ),
      },
    ],
  },
  {
    path: "/",
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "auth/callback",
        element: (
          <Lazy label="Signing in…" tone="plain">
            <AuthCallbackPageLazy />
          </Lazy>
        ),
      },
      {
        path: "notes",
        element: (
          <Lazy label="Loading notes…" tone="plain">
            <NotesPageLazy />
          </Lazy>
        ),
      },
      {
        path: "notes/:noteId",
        element: (
          <Lazy label="Loading note…" tone="plain">
            <NotePageLazy />
          </Lazy>
        ),
      },
      {
        path: "categories",
        element: (
          <Lazy label="Loading categories…" tone="plain">
            <CategoriesPageLazy />
          </Lazy>
        ),
      },
      {
        path: "categories/:slug",
        element: (
          <Lazy label="Loading category…" tone="plain">
            <CategoryPageLazy />
          </Lazy>
        ),
      },
      { path: "publish", element: <Navigate to="/studio/notes" replace /> },
      {
        path: "mindmaps",
        element: (
          <Lazy label="Loading mindmaps…" tone="plain">
            <MindmapsPageLazy />
          </Lazy>
        ),
      },
      {
        path: "mindmaps/:mindmapId",
        element: (
          <Lazy label="Loading mindmap…" tone="card">
            <MindmapPageLazy />
          </Lazy>
        ),
      },
      {
        path: "roadmaps",
        element: (
          <Lazy label="Loading roadmaps…" tone="plain">
            <RoadmapsPageLazy />
          </Lazy>
        ),
      },
      {
        path: "roadmaps/:roadmapId",
        element: (
          <Lazy label="Loading roadmap…" tone="plain">
            <RoadmapPageLazy />
          </Lazy>
        ),
      },
      {
        path: "roadmaps/:roadmapId/node/:nodeId",
        element: (
          <Lazy label="Loading node…" tone="plain">
            <RoadmapNodePageLazy />
          </Lazy>
        ),
      },
      {
        path: "projects",
        element: (
          <Lazy label="Loading projects…" tone="plain">
            <ProjectsPageLazy />
          </Lazy>
        ),
      },
      {
        path: "projects/:projectId",
        element: (
          <Lazy label="Loading project…" tone="plain">
            <ProjectPageLazy />
          </Lazy>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
