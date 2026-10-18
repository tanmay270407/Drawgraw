import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useState } from "react";

import type { AppState } from "@excalidraw/excalidraw/types";

import { supabase } from "../data/supabaseClient";

import "./CloudDrawings.scss";

type SavedDrawing = {
  id: string;
  title: string;
  updated_at: string;
  scene: {
    elements: NonNullable<
      ReturnType<typeof useExcalidrawAPI>
    >["getSceneElements"] extends () => infer T
      ? T
      : never;
    appState: Pick<
      AppState,
      "viewBackgroundColor" | "gridSize" | "gridModeEnabled" | "theme" | "name"
    >;
    files: NonNullable<
      ReturnType<typeof useExcalidrawAPI>
    >["getFiles"] extends () => infer T
      ? T
      : never;
  };
};

type DrawingSummary = Pick<SavedDrawing, "id" | "title" | "updated_at">;

export const CloudDrawings = () => {
  const api = useExcalidrawAPI();
  const [userId, setUserId] = useState("");
  const [drawings, setDrawings] = useState<DrawingSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [title, setTitle] = useState("Untitled drawing");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);

  const loadDrawings = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }
    const { data, error } = await supabase
      .from("drawings")
      .select("id, title, updated_at")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      setMessage("Run the Supabase SQL setup to enable cloud drawings.");
      return;
    }
    setDrawings(data ?? []);
  }, [userId]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUserId(data.user?.id ?? "");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    void loadDrawings();
  }, [loadDrawings, userId]);

  const saveDrawing = async (asCopy = false) => {
    if (!supabase || !api || !userId) {
      return;
    }
    setBusy(true);
    setMessage("");
    const currentState = api.getAppState();
    const scene = {
      elements: api.getSceneElements(),
      appState: {
        viewBackgroundColor: currentState.viewBackgroundColor,
        gridSize: currentState.gridSize,
        gridModeEnabled: currentState.gridModeEnabled,
        theme: currentState.theme,
        name: title.trim() || "Untitled drawing",
      },
      files: api.getFiles(),
    };
    const values = {
      owner_id: userId,
      title: title.trim() || "Untitled drawing",
      scene,
      updated_at: new Date().toISOString(),
    };
    const targetId = asCopy ? "" : activeId;
    const result = targetId
      ? await supabase.from("drawings").update(values).eq("id", targetId)
      : await supabase.from("drawings").insert(values).select("id").single();

    if (result.error) {
      setMessage(
        result.error.code === "42P01" || result.error.code === "PGRST205"
          ? "Run the Supabase SQL setup to enable cloud drawings."
          : result.error.message,
      );
    } else {
      if ((!activeId || asCopy) && result.data) {
        setActiveId(result.data.id);
      }
      setMessage("Saved to your account.");
      await loadDrawings();
    }
    setBusy(false);
  };

  const openDrawing = async (id: string) => {
    if (!supabase || !api || !id) {
      setActiveId("");
      return;
    }
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase
      .from("drawings")
      .select("id, title, updated_at, scene")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();
    if (error || !data) {
      setMessage(error?.message ?? "Could not open this drawing.");
    } else {
      const scene = data.scene as SavedDrawing["scene"];
      api.addFiles(Object.values(scene.files ?? {}));
      api.updateScene({
        elements: scene.elements,
        appState: {
          viewBackgroundColor: scene.appState.viewBackgroundColor,
          gridSize: scene.appState.gridSize,
          gridModeEnabled: scene.appState.gridModeEnabled,
          theme: scene.appState.theme,
          name: scene.appState.name,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setActiveId(data.id);
      setTitle(data.title);
      setMessage("Drawing opened.");
    }
    setBusy(false);
  };

  const deleteDrawing = async () => {
    if (!supabase || !activeId || !userId) {
      return;
    }
    if (!window.confirm(`Delete “${title}” from your cloud drawings?`)) {
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("drawings")
      .delete()
      .eq("id", activeId)
      .eq("owner_id", userId);
    if (error) {
      setMessage(error.message);
    } else {
      setActiveId("");
      setTitle("Untitled drawing");
      setMessage("Cloud drawing deleted.");
      await loadDrawings();
    }
    setBusy(false);
  };

  return (
    <section className="cloud-drawings" aria-label="Cloud drawings">
      <button
        aria-expanded={expanded}
        className="cloud-drawings__toggle"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <span aria-hidden="true">☁</span>{" "}
        {expanded ? "Cloud drawings" : "Cloud"}
      </button>
      {expanded && (
        <div className="cloud-drawings__panel">
          <label>
            <span>Drawing name</span>
            <input
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <div className="cloud-drawings__actions">
            <button
              disabled={busy}
              onClick={() => void saveDrawing()}
              type="button"
            >
              {busy ? "Working…" : "Save drawing"}
            </button>
            <button
              disabled={busy}
              onClick={() => void saveDrawing(true)}
              type="button"
            >
              Save as new
            </button>
            {activeId && (
              <button
                aria-label="Delete this cloud drawing"
                className="cloud-drawings__delete"
                disabled={busy}
                onClick={() => void deleteDrawing()}
                type="button"
              >
                Delete
              </button>
            )}
          </div>
          <label>
            <span>Open a saved drawing</span>
            <select
              disabled={busy || drawings.length === 0}
              onChange={(event) => void openDrawing(event.target.value)}
              value={activeId}
            >
              <option value="">Choose a drawing…</option>
              {drawings.map((drawing) => (
                <option key={drawing.id} value={drawing.id}>
                  {drawing.title}
                </option>
              ))}
            </select>
          </label>
          {message && <p role="status">{message}</p>}
          <button
            className="cloud-drawings__refresh"
            disabled={busy}
            onClick={() => void loadDrawings()}
            type="button"
          >
            Refresh list
          </button>
        </div>
      )}
    </section>
  );
};
