import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { OscarLogo } from "@/components/oscar-logo";
import { OSCAR } from "@/lib/brand";
import { getAccessToken, signInWithEmail, signUpWithEmail } from "@/lib/auth-session";
import { isBrowserAuthConfigured } from "@/lib/supabase-browser";
import { syncAuthSession } from "@/server/auth/functions";
import { getAnonymousId } from "@/lib/anonymous-id";

export function LoginView() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBrowserAuthConfigured()) {
      setError("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fn = mode === "signin" ? signInWithEmail : signUpWithEmail;
      const { error: authErr } = await fn(email.trim(), password);
      if (authErr) {
        setError(authErr.message);
        setLoading(false);
        return;
      }
      const token = await getAccessToken();
      if (token) {
        await syncAuthSession({ data: { accessToken: token, anonymousId: getAnonymousId() } });
      }
      await nav({ to: "/pricing" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <OscarLogo size="auth" className="mx-auto object-center" />
        <h1 className="mt-6 font-serif text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Free tier works without an account. Sign in to unlock paid {OSCAR.analysis} limits.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border bg-card p-6">
        <div className="flex gap-2">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize ${
                mode === m ? "bg-foreground text-background" : "bg-background"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-md border bg-background px-4 py-3 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border bg-background px-4 py-3 text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/pricing" className="font-semibold text-accent hover:underline">
          View plans
        </Link>
        {" · "}
        <Link to="/analyze" className="hover:underline">
          Continue without signing in
        </Link>
      </p>
    </main>
  );
}
