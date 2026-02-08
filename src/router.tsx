import React from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./ui/shell/AppShell";
import { CategoryPage } from "./ui/views/CategoryPage";
import { CategoriesPage } from "./ui/views/CategoriesPage";
import { AuthCallbackPage } from "./ui/views/AuthCallbackPage";
import { ErrorPage } from "./ui/views/ErrorPage";
import { HomePage } from "./ui/views/HomePage";
import { MindmapsPage } from "./ui/views/MindmapsPage";
import { NotePage } from "./ui/views/NotePage";
import { NotesPage } from "./ui/views/NotesPage";
import { NotFoundPage } from "./ui/views/NotFoundPage";
import { ProjectPage } from "./ui/views/ProjectPage";
import { ProjectsPage } from "./ui/views/ProjectsPage";
import { RoadmapNodePage } from "./ui/views/RoadmapNodePage";
import { RoadmapPage } from "./ui/views/RoadmapPage";
import { RoadmapsPage } from "./ui/views/RoadmapsPage";
import { StudioShell } from "./studio/shell/StudioShell";
import { StudioAssetsPage } from "./studio/views/StudioAssetsPage";
import { StudioConfigPage } from "./studio/views/StudioConfigPage";
import { StudioNotesPage } from "./studio/views/StudioNotesPage";
import { StudioNotFoundPage } from "./studio/views/StudioNotFoundPage";
import { StudioRoadmapsPage } from "./studio/views/StudioRoadmapsPage";

const StudioMindmapsPageLazy = React.lazy(() =>
  import("./studio/views/StudioMindmapsPage").then((m) => ({ default: m.StudioMindmapsPage })),
);

const MindmapPageLazy = React.lazy(() => import("./ui/views/MindmapPage").then((m) => ({ default: m.MindmapPage })));

export const router = createBrowserRouter([
  {
    path: "/studio",
    element: <StudioShell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/studio/notes" replace /> },
      { path: "notes", element: <StudioNotesPage /> },
      {
        path: "mindmaps",
        element: (
          <React.Suspense fallback={<div className="p-4 text-sm text-[hsl(var(--muted))]">Loading mindmap editor…</div>}>
            <StudioMindmapsPageLazy />
          </React.Suspense>
        ),
      },
      { path: "assets", element: <StudioAssetsPage /> },
      { path: "roadmaps", element: <StudioRoadmapsPage /> },
      { path: "config", element: <StudioConfigPage /> },
      { path: "*", element: <StudioNotFoundPage /> },
    ],
  },
  {
    path: "/",
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "auth/callback", element: <AuthCallbackPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "notes/:noteId", element: <NotePage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "categories/:slug", element: <CategoryPage /> },
      { path: "publish", element: <Navigate to="/studio/notes" replace /> },
      { path: "mindmaps", element: <MindmapsPage /> },
      {
        path: "mindmaps/:mindmapId",
        element: (
          <React.Suspense fallback={<div className="card p-8 text-sm text-[hsl(var(--muted))]">Loading mindmap…</div>}>
            <MindmapPageLazy />
          </React.Suspense>
        ),
      },
      { path: "roadmaps", element: <RoadmapsPage /> },
      { path: "roadmaps/:roadmapId", element: <RoadmapPage /> },
      { path: "roadmaps/:roadmapId/node/:nodeId", element: <RoadmapNodePage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:projectId", element: <ProjectPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
