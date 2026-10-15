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
const LOCAL_OWNER = "renova-local-owner-v1";

declare global {
  interface Window {
    RENOVA_CONFIG?: {
      supabaseUrl: string;
      supabaseAnonKey: string;
      googleCalendarEnabled: boolean;
      userId: string;
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
  const [showPassword, setShowPassword] = useState(false);
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
        <p className="auth-loading">Memeriksa sesi...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <main className="auth-minimal">
          <a className="auth-minimal-brand" href="/" aria-label="Renova home">
            Renova
          </a>
          <h1>Login</h1>
          <p className="auth-minimal-intro">
            Masuk ke workspace pribadimu.
          </p>
          <form onSubmit={handleSignIn}>
            <div className="field auth-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nama@email.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="field auth-field">
              <label htmlFor="login-password">Kata sandi</label>
              <div className="auth-password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.6 4.5 9.5 6-.4.7-1.3 1.9-2.7 3M6.2 6.2C4.1 7.5 2.8 9.5 2.5 11c.7 1.2 4 6 9.5 6 1 0 2-.2 2.9-.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {authError && (
              <p className="auth-error" role="alert">
                {authError}
              </p>
            )}
            <button className="primary-button auth-submit" disabled={signingIn}>
              {signingIn ? "Sedang masuk..." : "Login"}
            </button>
          </form>
          <p className="auth-minimal-note">Private workspace · Renova</p>
        </main>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    let active = true;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let saveQueue = Promise.resolve();

    async function loadWorkspace() {
      const userStore = `${STORE}:${session.user.id}`;
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
        localStorage.setItem(userStore, JSON.stringify(data.state));
        if (
          !localStorage.getItem(LOCAL_OWNER) &&
          (localStorage.getItem(STORE) || localStorage.getItem(LEGACY_STORE))
        ) {
          localStorage.setItem(LOCAL_OWNER, session.user.id);
        }
      } else {
        let localState = localStorage.getItem(userStore);
        if (!localState) {
          const localOwner = localStorage.getItem(LOCAL_OWNER);
          if (!localOwner || localOwner === session.user.id) {
            localState =
              localStorage.getItem(STORE) ??
              localStorage.getItem(LEGACY_STORE);
            if (localState) {
              localStorage.setItem(userStore, localState);
              localStorage.setItem(LOCAL_OWNER, session.user.id);
            }
          }
        }
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
        userId: session.user.id,
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
      <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
        <aside className="sidebar glass">
          <a className="brand" href="#home">
            <span>Renova</span>
          </a>
          <button
            className="icon-button sidebar-collapse"
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>
          <button
            id="mobileSidebarCollapse"
            className="sidebar-mobile-collapse"
            type="button"
            aria-label="Close navigation menu"
            title="Close navigation menu"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
            <span>Close menu</span>
          </button>
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
        <button
          id="sidebarBackdrop"
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          tabIndex={-1}
        />
        <main>
          <header className="topbar glass">
            <button
              id="mobileMenu"
              className="icon-button mobile-only"
              aria-label="Open menu"
              aria-expanded={false}
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
