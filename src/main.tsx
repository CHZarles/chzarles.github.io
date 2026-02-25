import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "katex/dist/katex.min.css";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

// Trigger a subtle "refresh" fade-in after first paint.
try {
  if (document.documentElement.dataset.hbMounted !== "1") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.dataset.hbMounted = "1";
      });
    });
  }
} catch {
  // ignore
}
