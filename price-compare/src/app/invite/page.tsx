"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Mail, Phone, Send, Clock, Loader2, UserPlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiFetchJson, formatApiError, showApiErrorToast } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type InviteType = "email" | "whatsapp";

interface Invitation {
  id: string;
  type: string;
  target: string;
  message: string | null;
  status: string;
  createdAt: string;
}

export default function InvitePage() {
  const { data: session, status: authStatus } = useSession();
  const [inviteType, setInviteType] = useState<InviteType>("whatsapp");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  if (authStatus === "unauthenticated") redirect("/login");

  const fetchInvitations = useCallback(async () => {
    try {
      const data = await apiFetchJson<Invitation[]>("/api/invite");
      setInvitations(data);
    } catch (err) {
      setError(formatApiError(err, "Could not load invitations"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSending(true);

    try {
      const data = await apiFetchJson<{ whatsappUrl?: string }>("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: inviteType,
          target: target.trim(),
          message: message.trim() || undefined,
        }),
      });

      // For WhatsApp, open the link in a new tab
      if (inviteType === "whatsapp" && data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }

      setSuccess(
        inviteType === "whatsapp"
          ? "WhatsApp invite opened! Send the message in the WhatsApp window."
          : `Invitation recorded for ${target.trim()}`
      );
      setTarget("");
      setMessage("");
      fetchInvitations();
    } catch (err) {
      const message = formatApiError(err, "Network error. Please try again.");
      setError(message);
      showApiErrorToast(toast, err, "Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserPlus className="h-6 w-6" />
          Invite People
        </h1>
        <p className="text-sm text-foreground/60 mt-1">
          Invite colleagues to join Retail Evaluator via email or WhatsApp.
        </p>
      </div>

      {/* Invite Form */}
      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-foreground/10 p-5">
        {/* Type toggle */}
        <div>
          <label className="block text-sm font-medium mb-2">Send via</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setInviteType("whatsapp"); setTarget(""); setError(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors border",
                inviteType === "whatsapp"
                  ? "bg-green-600 text-white border-green-600"
                  : "border-foreground/20 hover:bg-foreground/5"
              )}
            >
              <Phone className="h-4 w-4" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => { setInviteType("email"); setTarget(""); setError(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors border",
                inviteType === "email"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-foreground/20 hover:bg-foreground/5"
              )}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
          </div>
        </div>

        {/* Target input */}
        <div>
          <label htmlFor="target" className="block text-sm font-medium mb-1">
            {inviteType === "email" ? "Email address" : "Phone number"}
          </label>
          <input
            id="target"
            type={inviteType === "email" ? "email" : "tel"}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={
              inviteType === "email"
                ? "colleague@company.com"
                : "+505 8888 0000"
            }
            required
            className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
          {inviteType === "whatsapp" && (
            <p className="text-xs text-foreground/50 mt-1">
              Include country code (e.g. +505 for Nicaragua)
            </p>
          )}
        </div>

        {/* Optional message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-1">
            Personal message <span className="text-foreground/50">(optional)</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Hey! Check out this tool we use for store evaluations..."
            className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/30 resize-none"
          />
        </div>

        {/* Status messages */}
        {error && (
          <div className="rounded-md bg-red-500/10 text-red-600 px-3 py-2 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-500/10 text-green-600 px-3 py-2 text-sm flex items-center gap-2">
            {inviteType === "whatsapp" && <ExternalLink className="h-4 w-4 flex-shrink-0" />}
            {success}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={sending || !target.trim()}
          className="flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {sending
            ? "Sending…"
            : inviteType === "whatsapp"
            ? "Open in WhatsApp"
            : "Send Invitation"}
        </button>
      </form>

      {/* History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Sent Invitations</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-foreground/50">No invitations sent yet.</p>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 rounded-md border border-foreground/10 px-4 py-3"
              >
                <div className="flex-shrink-0">
                  {inv.type === "whatsapp" ? (
                    <Phone className="h-4 w-4 text-green-500" />
                  ) : (
                    <Mail className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{inv.target}</p>
                  <p className="text-xs text-foreground/50 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(inv.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    inv.status === "sent"
                      ? "bg-green-500/10 text-green-600"
                      : "bg-foreground/10 text-foreground/60"
                  )}
                >
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
