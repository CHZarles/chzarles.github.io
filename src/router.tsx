import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./ui/shell/AppShell";
import { CategoryPage } from "./ui/views/CategoryPage";
import { CategoriesPage } from "./ui/views/CategoriesPage";
import { HomePage } from "./ui/views/HomePage";
import { NotePage } from "./ui/views/NotePage";
import { NotesPage } from "./ui/views/NotesPage";
import { NotFoundPage } from "./ui/views/NotFoundPage";
import { ProjectPage } from "./ui/views/ProjectPage";
import { ProjectsPage } from "./ui/views/ProjectsPage";
import { RoadmapNodePage } from "./ui/views/RoadmapNodePage";
import { RoadmapPage } from "./ui/views/RoadmapPage";
import { RoadmapsPage } from "./ui/views/RoadmapsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "notes/:noteId", element: <NotePage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "categories/:slug", element: <CategoryPage /> },
      { path: "roadmaps", element: <RoadmapsPage /> },
      { path: "roadmaps/:roadmapId", element: <RoadmapPage /> },
      { path: "roadmaps/:roadmapId/node/:nodeId", element: <RoadmapNodePage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:projectId", element: <ProjectPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

