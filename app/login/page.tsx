"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type Mode = "signin" | "signup";

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
  background: "#05071a",
  border: "1px solid #1e2a4a",
  borderRadius: "0.6rem",
  padding: "0.7rem 0.9rem",
  color: "#e2e8f0",
  fontSize: "0.875rem",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  letterSpacing: "0.15em",
  color: "lightgray",
  marginBottom: "0.35rem",
};

const primaryBtnStyle: React.CSSProperties = {
  minHeight: "44px",
  background: "linear-gradient(135deg, #4488ff22, #4488ff44)",
  border: "2px solid #4488ff66",
  color: "#4488ff",
};

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: "#1e2a4a" }} />
      <span className="font-orbitron text-xs tracking-widest text-gray-400">OR</span>
      <div className="flex-1 h-px" style={{ background: "#1e2a4a" }} />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
    // signIn redirects on success; only reaches here on error
    setLoading(false);
  }

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (displayName.trim().length < 2) {
        setError("Display name must be at least 2 characters.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not create your account.");
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(
          mode === "signup"
            ? "Account created, but automatic sign-in failed. Please sign in."
            : "Invalid email or password."
        );
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function goSignup() {
    setMode("signup");
    setError(null);
  }

  function goSignin() {
    setMode("signin");
    setError(null);
  }

  return (
    <main
      className="flex items-center justify-center min-h-[calc(100vh-56px)] px-6 py-12"
      style={{ background: "#05071a" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-orbitron text-xs tracking-[0.4em] text-gray-400 mb-3">WELCOME</div>
          <h1 className="font-orbitron font-black text-2xl tracking-widest text-white">
            {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </h1>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: "#070d20", border: "1px solid #1e2a4a", boxShadow: "0 0 30px #4488ff11" }}>
          {error && (
            <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleEmail} className="flex flex-col">
            {/* ── Input group ── */}
            <div className="flex flex-col gap-6">
              {mode === "signup" && (
                <div>
                  <label style={labelStyle} className="font-orbitron">
                    DISPLAY NAME
                  </label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Commander Shepard"
                    autoComplete="nickname"
                  />
                  <p className="text-gray-600 text-xs mt-1">This is what other players will see</p>
                </div>
              )}

              <div>
                <label style={labelStyle} className="font-orbitron">
                  EMAIL
                </label>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label style={labelStyle} className="font-orbitron">
                  PASSWORD
                </label>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>

              {mode === "signup" && (
                <div>
                  <label style={labelStyle} className="font-orbitron">
                    CONFIRM PASSWORD
                  </label>
                  <input
                    style={inputStyle}
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              )}
            </div>

            {/* ── Button group ── */}
            <div className="flex flex-col gap-5 mt-6">
            {/* Primary action button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-4 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={primaryBtnStyle}>
              {loading ? "PLEASE WAIT..." : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>

            {/* OR + Gmail — only in sign-in mode */}
            {mode === "signin" && (
              <>
                <OrDivider />

                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={primaryBtnStyle}>
                  <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                    <path
                      d="M43.6 20.2H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.8z"
                      fill="#4488ff"
                      opacity="0.7"
                    />
                  </svg>
                  SIGN IN WITH GMAIL
                </button>

                <OrDivider />

                <button
                  type="button"
                  onClick={goSignup}
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={primaryBtnStyle}>
                  CREATE ACCOUNT
                </button>
              </>
            )}

            {/* Back link in signup mode */}
            {mode === "signup" && (
              <p className="text-center text-xs text-gray-500 pt-1">
                Already have an account?{" "}
                <button type="button" onClick={goSignin} className="text-[#4488ff] hover:underline">
                  Sign in
                </button>
              </p>
            )}
            </div>{/* end button group */}
          </form>
        </div>

        {/* <p className="text-gray-600 text-xs mt-6 text-center">
          3 free games on signup · No credit card required
        </p> */}
      </div>
    </main>
  );
}
