import { useEffect, useState } from "react";

import { isSupabaseConfigured, supabase } from "../data/supabaseClient";

import "./SupabaseAuthGate.scss";

import type { Session, User } from "@supabase/supabase-js";

type AuthMode = "sign-in" | "sign-up" | "reset-password" | "update-password";
type Notice = { kind: "success" | "error"; message: string } | null;

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

const saveProfile = async (user: User) => {
  if (!supabase) {
    return null;
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name:
        typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : "",
      phone_number:
        typeof user.user_metadata?.phone_number === "string"
          ? user.user_metadata.phone_number
          : "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  return error;
};

const AuthForm = ({
  initialMode = "sign-in",
  onPasswordUpdated,
}: {
  initialMode?: AuthMode;
  onPasswordUpdated?: () => void;
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const isSignUp = mode === "sign-up";
  const isReset = mode === "reset-password";
  const isUpdatingPassword = mode === "update-password";

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setNotice(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) {
          throw error;
        }
        setNotice({
          kind: "success",
          message:
            "If an account exists for that email, a password reset link is on its way.",
        });
      } else if (isUpdatingPassword) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          throw error;
        }
        setPassword("");
        setNotice({
          kind: "success",
          message: "Your password has been updated.",
        });
        onPasswordUpdated?.();
      } else if (isSignUp) {
        const normalizedPhoneNumber = phoneNumber.trim();
        if (!/^\+?[\d\s().-]{7,32}$/.test(normalizedPhoneNumber)) {
          throw new Error(
            "Enter a valid phone number, including country code if needed.",
          );
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName.trim(),
              phone_number: normalizedPhoneNumber,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          throw error;
        }

        if (!data.session) {
          setNotice({
            kind: "success",
            message:
              "Check your email for a confirmation link, then come back here to sign in.",
          });
          setMode("sign-in");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          throw error;
        }
      }
    } catch (error) {
      setNotice({ kind: "error", message: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-heading">
        <a className="auth-brand" href="/" aria-label="Drawgraw home">
          <span className="auth-brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M7 5h8a11 11 0 0 1 0 22H7V5Z" />
              <path d="M13 11h2a5 5 0 0 1 0 10h-2V11Z" />
            </svg>
          </span>
          <span>Drawgraw</span>
        </a>

        <div className="auth-card__intro">
          <p className="auth-eyebrow">Your ideas, in one place</p>
          <h1 id="auth-heading">
            {isUpdatingPassword
              ? "Choose a new password"
              : isReset
              ? "Reset your password"
              : isSignUp
              ? "Create your account"
              : "Welcome back"}
          </h1>
          <p>
            {isUpdatingPassword
              ? "Use at least 8 characters for your new password."
              : isReset
              ? "We’ll email you a secure link to choose a new password."
              : isSignUp
              ? "Sign up to open your canvas and keep your work close."
              : "Sign in to continue to your canvas."}
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="auth-notice auth-notice--error" role="alert">
            Supabase isn’t configured. Set VITE_SUPABASE_URL and
            VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {isSignUp && (
              <label className="auth-field">
                <span>Name</span>
                <input
                  autoComplete="name"
                  maxLength={80}
                  name="displayName"
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  required
                  value={displayName}
                />
              </label>
            )}

            {isSignUp && (
              <label className="auth-field">
                <span>Phone number</span>
                <input
                  autoComplete="tel"
                  maxLength={32}
                  minLength={7}
                  name="phoneNumber"
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+1 555 123 4567"
                  required
                  type="tel"
                  value={phoneNumber}
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            {!isReset && (
              <label className="auth-field">
                <span>Password</span>
                <span className="auth-password">
                  <input
                    autoComplete={
                      isSignUp ? "new-password" : "current-password"
                    }
                    minLength={8}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="auth-password__toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    type="button"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </label>
            )}

            {notice && (
              <div
                className={`auth-notice auth-notice--${notice.kind}`}
                role="status"
              >
                {notice.message}
              </div>
            )}

            <button className="auth-submit" disabled={busy} type="submit">
              {busy
                ? "Please wait…"
                : isReset
                ? "Send reset link"
                : isUpdatingPassword
                ? "Update password"
                : isSignUp
                ? "Create account"
                : "Sign in"}
              {!busy && <span aria-hidden="true">→</span>}
            </button>
          </form>
        )}

        {isSupabaseConfigured && (
          <div className="auth-links">
            {isReset || isUpdatingPassword ? (
              <button onClick={() => switchMode("sign-in")} type="button">
                Back to sign in
              </button>
            ) : (
              <>
                {!isSignUp && (
                  <button
                    onClick={() => switchMode("reset-password")}
                    type="button"
                  >
                    Forgot password?
                  </button>
                )}
                <p>
                  {isSignUp
                    ? "Already have an account?"
                    : "New to Drawgraw?"}{" "}
                  <button
                    onClick={() => switchMode(isSignUp ? "sign-in" : "sign-up")}
                    type="button"
                  >
                    {isSignUp ? "Sign in" : "Create an account"}
                  </button>
                </p>
              </>
            )}
          </div>
        )}

        <p className="auth-card__footnote">
          Your account is secured by Supabase Auth. Passwords are never stored
          in this app.
        </p>
      </section>
    </main>
  );
};

export const SupabaseAuthGate = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get("type") ===
      "recovery",
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecovery(true);
        } else if (event === "SIGNED_OUT") {
          setPasswordRecovery(false);
        }
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (mounted) {
        setSession(error ? null : data.session);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setProfileNotice(null);
      return;
    }

    let mounted = true;
    void saveProfile(session.user)
      .then((error) => {
        if (mounted) {
          setProfileNotice(
            error
              ? "You’re signed in. Run the provided Supabase SQL to enable profile syncing."
              : null,
          );
        }
      })
      .catch(() => {
        if (mounted) {
          setProfileNotice(
            "You’re signed in, but your profile could not sync right now.",
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  const signOut = async () => {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      setProfileNotice(error.message);
    }
  };

  if (loading) {
    return (
      <main className="auth-loading" aria-label="Loading your account">
        <span className="auth-loading__spinner" />
        <span>Checking your account…</span>
      </main>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  if (passwordRecovery) {
    return (
      <AuthForm
        initialMode="update-password"
        onPasswordUpdated={() => setPasswordRecovery(false)}
      />
    );
  }

  return (
    <div className="auth-shell">
      <header className="account-bar">
        <a className="account-bar__brand" href="/">
          <span className="account-bar__mark" aria-hidden="true">
            ✳
          </span>
          Drawgraw
        </a>
        <div className="account-bar__user">
          <span className="account-bar__email" title={session.user.email}>
            {session.user.email}
          </span>
          <button
            className="account-bar__signout"
            onClick={signOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>
      {profileNotice && (
        <div className="account-bar__notice" role="status">
          {profileNotice}
        </div>
      )}
      <div className="auth-shell__editor">{children}</div>
    </div>
  );
};
