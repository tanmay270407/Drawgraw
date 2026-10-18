import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";
import { DrawgrawLibraries } from "./components/DrawgrawLibraries";
import { SupabaseAuthGate } from "./components/SupabaseAuthGate";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
root.render(
  <StrictMode>
    {new URLSearchParams(window.location.search).get("view") ===
    "libraries" ? (
      <DrawgrawLibraries />
    ) : (
      <SupabaseAuthGate>
        <ExcalidrawApp />
      </SupabaseAuthGate>
    )}
  </StrictMode>,
);
