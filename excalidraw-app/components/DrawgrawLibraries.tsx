import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../data/supabaseClient";

import "./DrawgrawLibraries.scss";

type LibraryRecord = {
  id: string;
  title: string;
  description: string;
  author_name: string;
  storage_path: string;
  item_count: number;
  created_at: string;
  owner_id: string;
};

const BUCKET = "drawgraw-libraries";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const getPublicUrl = (path: string) => {
  if (!supabase) {
    return "";
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

const makeEditorUrl = (libraryUrl: string) => {
  const url = new URL("/", window.location.origin);
  url.hash = new URLSearchParams({
    addLibrary: libraryUrl,
    token: "drawgraw-library-marketplace",
  }).toString();
  return url.toString();
};

export const DrawgrawLibraries = () => {
  const [libraries, setLibraries] = useState<LibraryRecord[]>([]);
  const [userId, setUserId] = useState("");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadLibraries = useCallback(async () => {
    if (!supabase) {
      setMessage("Drawgraw Libraries needs Supabase configuration.");
      return;
    }
    const { data, error } = await supabase
      .from("drawgraw_libraries")
      .select("id, title, description, author_name, storage_path, item_count, created_at, owner_id")
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    if (error) {
      setMessage(
        error.code === "42P01" || error.code === "PGRST205"
          ? "Run the Drawgraw Libraries SQL setup to create the public catalog."
          : error.message,
      );
      return;
    }
    setLibraries(data ?? []);
    setMessage("");
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    void Promise.all([supabase.auth.getUser(), loadLibraries()]).then(
      ([{ data }]) => {
        if (active) {
          setUserId(data.user?.id ?? "");
        }
      },
    );
    return () => {
      active = false;
    };
  }, [loadLibraries]);

  const visibleLibraries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return libraries;
    }
    return libraries.filter((item) =>
      `${item.title} ${item.description} ${item.author_name}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [libraries, query]);

  const publishLibrary = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !userId || !file) {
      setMessage("Choose an .excalidrawlib file to publish.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage("Library files must be 5 MB or smaller.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const content = JSON.parse(await file.text()) as {
        type?: string;
        libraryItems?: unknown[];
      };
      if (
        content.type !== "excalidrawlib" ||
        !Array.isArray(content.libraryItems) ||
        content.libraryItems.length === 0
      ) {
        throw new Error("This file does not contain a valid drawing library.");
      }
      if (content.libraryItems.length > 100) {
        throw new Error("A library can contain up to 100 items.");
      }
      const cleanTitle = title.trim();
      if (cleanTitle.length < 2 || cleanTitle.length > 80) {
        throw new Error("Library name must be between 2 and 80 characters.");
      }
      const path = `${userId}/${crypto.randomUUID()}.excalidrawlib`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: "application/json", upsert: false });
      if (uploadError) {
        throw uploadError;
      }

      const { data: userData } = await supabase.auth.getUser();
      const authorName =
        typeof userData.user?.user_metadata?.display_name === "string" &&
        userData.user.user_metadata.display_name.trim()
          ? userData.user.user_metadata.display_name.trim().slice(0, 80)
          : "Drawgraw creator";
      const { error: insertError } = await supabase
        .from("drawgraw_libraries")
        .insert({
          owner_id: userId,
          title: cleanTitle,
          description: description.trim().slice(0, 500),
          author_name: authorName,
          storage_path: path,
          item_count: content.libraryItems.length,
          is_public: true,
        });
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insertError;
      }

      setTitle("");
      setDescription("");
      setFile(null);
      const input = document.getElementById(
        "drawgraw-library-file",
      ) as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      setMessage("Your library is now published in Drawgraw Libraries.");
      await loadLibraries();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not publish this library.",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeLibrary = async (item: LibraryRecord) => {
    if (!supabase || item.owner_id !== userId) {
      return;
    }
    setBusy(true);
    const { error: deleteError } = await supabase
      .from("drawgraw_libraries")
      .delete()
      .eq("id", item.id)
      .eq("owner_id", userId);
    if (deleteError) {
      setMessage(deleteError.message);
    } else {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([item.storage_path]);
      setMessage(
        storageError
          ? `Library removed from the catalog, but its file could not be deleted: ${storageError.message}`
          : "Library removed from Drawgraw Libraries.",
      );
      await loadLibraries();
    }
    setBusy(false);
  };

  return (
    <main className="drawgraw-libraries">
      <header className="drawgraw-libraries__account-bar">
        <a href="/" className="drawgraw-libraries__brand">
          <span aria-hidden="true">✳</span> Drawgraw
        </a>
        {userId ? (
          <span className="drawgraw-libraries__account-label">Drawgraw account connected</span>
        ) : (
          <a className="drawgraw-libraries__sign-in" href="/">
            Sign in to publish
          </a>
        )}
      </header>
      <div className="drawgraw-libraries__hero">
        <div>
          <p className="drawgraw-libraries__eyebrow">DRAWGRAW COMMUNITY</p>
          <h1>Drawgraw Libraries</h1>
          <p className="drawgraw-libraries__intro">
            Find reusable diagrams and visual building blocks, or share a
            library you made.
          </p>
        </div>
        <a className="drawgraw-libraries__back" href="/">
          <span aria-hidden="true">←</span> Back to canvas
        </a>
      </div>

      <section className="drawgraw-libraries__catalog" aria-label="Public libraries">
        <div className="drawgraw-libraries__catalog-head">
          <div>
            <h2>Explore libraries</h2>
            <p>Install any library directly into your Drawgraw editor.</p>
          </div>
          <label className="drawgraw-libraries__search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search libraries"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search libraries"
              value={query}
            />
          </label>
        </div>

        {message && <p className="drawgraw-libraries__notice" role="status">{message}</p>}

        {visibleLibraries.length ? (
          <div className="drawgraw-libraries__grid">
            {visibleLibraries.map((item) => {
              const publicUrl = getPublicUrl(item.storage_path);
              return (
                <article className="drawgraw-library-card" key={item.id}>
                  <div className="drawgraw-library-card__art" aria-hidden="true">
                    <span>▱</span>
                    <span>◇</span>
                    <span>○</span>
                  </div>
                  <div className="drawgraw-library-card__body">
                    <div className="drawgraw-library-card__meta">
                      <span>{item.item_count} items</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description || "A Drawgraw community library."}</p>
                    <div className="drawgraw-library-card__footer">
                      <span>By {item.author_name}</span>
                      <a href={makeEditorUrl(publicUrl)} rel="noreferrer" target="_blank">
                        Add to canvas <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                    {item.owner_id === userId && (
                      <button
                        className="drawgraw-library-card__remove"
                        disabled={busy}
                        onClick={() => void removeLibrary(item)}
                        type="button"
                      >
                        Remove your library
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="drawgraw-libraries__empty">
            <span aria-hidden="true">✳</span>
            <h3>{query ? "No matching libraries" : "The library is just getting started"}</h3>
            <p>{query ? "Try another search." : "Publish the first Drawgraw library below."}</p>
          </div>
        )}
      </section>

      <section className="drawgraw-libraries__publish" aria-labelledby="publish-library-heading">
        <div>
          <p className="drawgraw-libraries__eyebrow">SHARE YOUR WORK</p>
          <h2 id="publish-library-heading">Publish a library</h2>
          <p>
            Export a library from the editor, then upload the .excalidrawlib
            file here. Published libraries are visible to everyone.
          </p>
        </div>
        <form onSubmit={(event) => void publishLibrary(event)}>
          <label>
            Library name
            <input
              maxLength={80}
              minLength={2}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          <label>
            Description <span>(optional)</span>
            <textarea
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              value={description}
            />
          </label>
          <label>
            Library file
            <input
              accept=".excalidrawlib,application/json,.json"
              id="drawgraw-library-file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
              type="file"
            />
          </label>
          <p className="drawgraw-libraries__privacy">
            Only upload content you have permission to share. Published library
            files can be downloaded by anyone.
          </p>
          {!userId && (
            <a className="drawgraw-libraries__sign-in-hint" href="/">
              Sign in to publish a library
            </a>
          )}
          <button disabled={busy || !file || !userId} type="submit">
            {busy ? "Publishing…" : "Publish to Drawgraw"}
          </button>
        </form>
      </section>
    </main>
  );
};
