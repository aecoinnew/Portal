"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Lock, Shield, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { roleHome, useAuth } from "@/contexts/auth-context";
import { BRAND } from "@/lib/branding/config";
import { BrandLogo } from "@/components/layout/brand-logo";

type Stage = "credentials" | "mfa";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [stage, setStage] = useState<Stage>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(roleHome(user.role));
    }
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, stage === "mfa" ? mfaCode : undefined);
      if (result.kind === "mfa_required") {
        setStage("mfa");
        return;
      }
      // If user must enroll MFA, send them to setup before their dashboard
      if (result.mustEnrollMfa) {
        router.replace("/admin/mfa-setup?reason=required");
        return;
      }
      router.replace(roleHome(result.user.role));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    setStage("credentials");
    setMfaCode("");
    setError(null);
  }

  return (
    <main className="flex min-h-screen">
      <section className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 lg:flex lg:flex-col lg:justify-between lg:p-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-40 right-10 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative z-10">
          <BrandLogo variant="light" size={44} />
        </div>
        <div className="relative z-10">
          <h1 className="font-display text-5xl font-bold leading-tight text-white">
            {BRAND.tagline.split(" ").slice(0, -1).join(" ")}
            <br />
            <span className="text-gold">{BRAND.tagline.split(" ").slice(-1)[0]}</span>
          </h1>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-white/70">
            {`Secure access to your ${BRAND.shortName} portfolio, statements, and investment requests.`}
          </p>
          <div className="mt-12 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <Shield className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Enterprise Security</p>
                <p className="text-xs text-white/50">256-bit encryption, MFA, JWT auth</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <Lock className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Secure Access</p>
                <p className="text-xs text-white/50">Role-based permissions</p>
              </div>
            </div>
          </div>
        </div>
        <p className="relative z-10 text-xs leading-relaxed text-white/30">
          {BRAND.legalFooter}
        </p>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center bg-white px-8 py-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-10 flex justify-center lg:hidden">
            <BrandLogo variant="dark" size={40} />
          </div>

          <div className="mb-10 text-center lg:text-left">
            {stage === "credentials" ? (
              <>
                <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">Welcome back</h2>
                <p className="mt-3 text-base text-slate-500">{`Sign in to your ${BRAND.name} portal`}</p>
              </>
            ) : (
              <>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">Two-factor verification</h2>
                <p className="mt-3 text-base text-slate-500">Enter the 6-digit code from your authenticator app.</p>
              </>
            )}
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {stage === "credentials" ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="email">Email address</label>
                  <input
                    id="email"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 transition-colors focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                    type="email"
                    placeholder="name@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
                  <input
                    id="password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 transition-colors focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <div className="mt-2 text-right">
                    <a
                      href="/forgot-password"
                      className="text-xs font-medium text-navy-700 hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="mfaCode">Verification code</label>
                <input
                  id="mfaCode"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-center font-mono text-xl tracking-[0.5em] text-slate-900 placeholder-slate-300 transition-colors focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))}
                  required
                />
                <button
                  type="button"
                  onClick={handleBack}
                  className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to email/password
                </button>
              </div>
            )}

            <button
              className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy-700 px-6 text-base font-semibold text-white shadow-lg shadow-navy-700/25 transition-all hover:bg-navy-800 hover:shadow-xl hover:shadow-navy-700/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={submitting || (stage === "mfa" && mfaCode.length !== 6)}
              type="submit"
            >
              {submitting ? "Signing in..." : stage === "credentials" ? "Sign in" : "Verify"}
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>

          <div className="mt-10 border-t border-slate-100 pt-8 text-center">
            <p className="text-xs leading-relaxed text-slate-400">
              Access is restricted to authorised account holders.
              <br />
              If you need assistance, contact your relationship manager.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
