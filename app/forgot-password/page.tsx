"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/api/client";
import { BRAND } from "@/lib/branding/config";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest<{ ok: boolean; message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        token: null
      });
      setDone(true);
    } catch (err) {
      // Even on error we avoid leaking details; show a generic message.
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-8 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <img src={BRAND.logoUrl} alt={BRAND.name} className="h-20 w-auto object-contain" />
        </div>

        {done ? (
          <div className="text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Request received</h2>
            <p className="mt-3 text-base text-slate-500">
              If an account exists for that email, an administrator has been notified and will help
              you reset your password. You&apos;ll receive a temporary password through a secure
              channel.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="font-display text-3xl font-bold text-slate-900">Forgot password</h2>
              <p className="mt-3 text-base text-slate-500">
                Enter your account email and an administrator will help you reset it.
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 transition-colors focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy-700 px-6 text-base font-semibold text-white shadow-lg shadow-navy-700/25 transition-all hover:bg-navy-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Sending…" : "Request password reset"}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
