"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "../utils/supabase/client";

type RenovaAppProps = {
  googleCalendarEnabled: boolean;
};

type WorkspaceState = Record<string, unknown>;
const STORE = "renova-v1";
const LEGACY_STORE = "life-os-v1";

declare global {
  interface Window {
    RENOVA_CONFIG?: {
      supabaseUrl: string;
      supabaseAnonKey: string;
      googleCalendarEnabled: boolean;
    };
  }
}

export default function RenovaApp({ googleCalendarEnabled }: RenovaAppProps) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
        setAuthLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAuthError(error instanceof Error ? error.message : String(error));
        setAuthLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setAuthError(error.message);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(`Gagal keluar: ${error.message}`);
        return;
      }
      window.location.reload();
    } catch (error) {
      setAuthError(
        `Gagal keluar: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (authLoading) {
    return (
      <div className="auth-screen">
        <section className="panel auth-card">Memeriksa sesi...</section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <section className="panel auth-card">
          <div className="brand auth-brand">
            <span className="brand-mark">R</span>
            <span>Renova</span>
          </div>
          <h1>Selamat datang kembali</h1>
          <p className="muted">
            Masuk ke akun pribadimu untuk membuka workspace.
          </p>
          <form onSubmit={handleSignIn}>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Kata sandi</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {authError && (
              <p className="auth-error" role="alert">
                {authError}
              </p>
            )}
            <button className="primary-button auth-submit" disabled={signingIn}>
              {signingIn ? "Sedang masuk..." : "Masuk"}
            </button>
          </form>
          <p className="muted auth-note">
            Akses privat untuk pemilik workspace.
          </p>
        </section>
      </div>
    );
  }

  return (
    <RenovaWorkspace
      key={session.user.id}
      supabase={supabase}
      session={session}
      googleCalendarEnabled={googleCalendarEnabled}
      onSignOut={handleSignOut}
    />
  );
}

function RenovaWorkspace({
  supabase,
  session,
  googleCalendarEnabled,
  onSignOut,
}: {
  supabase: ReturnType<typeof createClient>;
  session: Session;
  googleCalendarEnabled: boolean;
  onSignOut: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState("Menyiapkan sinkronisasi...");

  useEffect(() => {
    let active = true;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let saveQueue = Promise.resolve();

    async function loadWorkspace() {
      const { data, error: loadError } = await supabase
        .from("renova_workspace")
        .select("state")
        .eq("id", session.user.id)
        .maybeSingle();

      if (loadError) throw loadError;
      if (data) {
        if (
          !data.state ||
          typeof data.state !== "object" ||
          Array.isArray(data.state)
        ) {
          throw new Error(
            "Data workspace Supabase tidak memiliki format yang valid.",
          );
        }
        localStorage.setItem(STORE, JSON.stringify(data.state));
      } else {
        const localState =
          localStorage.getItem(STORE) ?? localStorage.getItem(LEGACY_STORE);
        if (localState) {
          const parsed: unknown = JSON.parse(localState);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error(
              "Data lokal Renova tidak memiliki format yang valid.",
            );
          }
        }
      }

      if (!active) return;
      window.RENOVA_CONFIG = {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        googleCalendarEnabled,
      };

      const onSave = (event: Event) => {
        const snapshot = (event as CustomEvent<WorkspaceState>).detail;
        if (!snapshot || typeof snapshot !== "object") {
          setSyncStatus("Gagal menyimpan data dengan format yang tidak valid.");
          return;
        }
        setSyncStatus("Menyimpan ke cloud...");
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveQueue = saveQueue
            .then(async () => {
              const { error: saveError } = await supabase
                .from("renova_workspace")
                .upsert(
                  {
                    id: session.user.id,
                    state: snapshot,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "id" },
                );
              if (saveError) throw saveError;
              if (active) setSyncStatus("Tersimpan di cloud");
            })
            .catch((saveError: unknown) => {
              console.error("Renova cloud save failed:", saveError);
              if (active) {
                const message =
                  saveError instanceof Error
                    ? saveError.message
                    : String(saveError);
                setSyncStatus(`Gagal menyimpan: ${message}`);
              }
            });
        }, 400);
      };

      window.addEventListener("renova:save", onSave);
      const script = document.createElement("script");
      script.src = "/app.js";
      script.async = true;
      script.onload = () => {
        if (active) setReady(true);
      };
      script.onerror = () => {
        if (active)
          setError(
            "Renova gagal dimuat. Muat ulang halaman untuk mencoba lagi.",
          );
      };
      document.body.appendChild(script);

      return () => {
        window.removeEventListener("renova:save", onSave);
        script.remove();
        delete window.RENOVA_CONFIG;
      };
    }

    let cleanup: (() => void) | undefined;
    void loadWorkspace()
      .then((dispose) => {
        cleanup = dispose;
      })
      .catch((loadError: unknown) => {
        console.error("Renova workspace load failed:", loadError);
        if (active) {
          setError(
            `Workspace gagal dimuat. Data lokal tidak diubah. ${
              loadError instanceof Error ? loadError.message : String(loadError)
            }`,
          );
        }
      });

    return () => {
      active = false;
      if (saveTimer) clearTimeout(saveTimer);
      cleanup?.();
    };
  }, [googleCalendarEnabled, session.user.id, supabase]);

  if (error) {
    return (
      <div className="auth-screen">
        <section className="panel auth-card">
          <h1>Workspace belum bisa dibuka</h1>
          <p className="auth-error" role="alert">
            {error}
          </p>
          <button
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            Coba lagi
          </button>
          <button className="text-button auth-logout" onClick={onSignOut}>
            Keluar
          </button>
        </section>
      </div>
    );
  }

  return (
    <>
      {!ready && (
        <div className="workspace-loading" role="status">
          <section className="panel auth-card">Memuat workspace privat...</section>
        </div>
      )}
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="app-shell">
        <aside className="sidebar glass">
          <a className="brand" href="#home">
            <span className="brand-mark">R</span>
            <span>Renova</span>
          </a>
          <nav id="nav" aria-label="Main navigation" />
          <div className="sidebar-footer">
            <button
              id="themeButton"
              className="icon-button"
              title="Toggle appearance"
              aria-label="Toggle appearance"
            />
            <button
              id="settingsButton"
              className="avatar"
              title="Settings"
              aria-label="Settings"
            >
              ?
            </button>
          </div>
        </aside>
        <main>
          <header className="topbar glass">
            <button
              id="mobileMenu"
              className="icon-button mobile-only"
              aria-label="Open menu"
            />
            <button id="searchButton" className="search-button">
              <span className="search-icon" />
              Search everything <kbd>⌘ K</kbd>
            </button>
            <button id="quickButton" className="primary-button">
              <span className="button-icon" /> <span>New</span>
            </button>
            <span
              className="status cloud-status"
              role="status"
              aria-live="polite"
            >
              {syncStatus}
            </span>
            <button className="text-button logout-button" onClick={onSignOut}>
              Keluar
            </button>
          </header>
          <section id="page" className="page" aria-live="polite" />
        </main>
      </div>
      <div id="modalRoot" />
      <div id="toast" role="status" />
    </>
  );
}
