"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/observations/new",
      });

      if (res?.error) {
        setError("Invalid credentials. Please check your email and password.");
        return;
      }

      router.push("/observations/new");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 border rounded-xl p-6 shadow-sm bg-background"
      >
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Retail Store Evaluator</h1>
          <p className="text-sm text-foreground/60">Sign in to your account</p>
        </div>

        <div>
          <label htmlFor="login-email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="login-email"
            className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-sm font-medium mb-1">Password</label>
          <input
            id="login-password"
            className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
            {error}
          </div>
        )}

        <button
          className="w-full rounded-lg p-2 font-medium bg-foreground text-background disabled:opacity-50 transition-opacity"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}