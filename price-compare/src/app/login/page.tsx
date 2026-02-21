"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { ApiClientError, apiFetchJson } from "@/lib/api-client";

type AuthMode = "signin" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        await apiFetchJson("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || undefined,
            email,
            password,
          }),
        });
      }

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
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "EMAIL_EXISTS") {
        setError("An account with this email already exists.");
        return;
      }
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
          <p className="text-sm text-foreground/60">
            {mode === "signin" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              resetForm();
            }}
            className={`rounded-md py-2 text-sm font-medium ${mode === "signin" ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              resetForm();
            }}
            className={`rounded-md py-2 text-sm font-medium ${mode === "register" ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}
          >
            Register
          </button>
        </div>

        {mode === "register" && (
          <div>
            <label htmlFor="register-name" className="block text-sm font-medium mb-1">Name</label>
            <input
              id="register-name"
              className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

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

        {mode === "register" && (
          <div>
            <label htmlFor="register-confirm-password" className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              id="register-confirm-password"
              className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">
            {error}
          </div>
        )}

        <button
          className="w-full rounded-lg p-2 font-medium bg-foreground text-background disabled:opacity-50 transition-opacity"
          disabled={loading}
        >
          {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}