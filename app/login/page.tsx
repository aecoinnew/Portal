"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { roleHome, useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("faisal.al-harbi@example.com");
  const [password, setPassword] = useState("Emcoin#2026");
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
      const nextUser = await login(email, password);
      router.replace(roleHome(nextUser.role));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-slate-50">
      <section className="relative hidden w-[52%] overflow-hidden bg-navy-700 p-12 lg:flex lg:flex-col lg:justify-between">
        <img src="/assets/mesh-bg.svg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative z-10">
          <img src="/assets/logo-emcoin-official.png" alt="Emcoin Investment" className="mb-12 h-[52px] w-auto object-contain brightness-0 invert" />
          <h1 className="font-display text-[38px] font-semibold leading-tight text-white">Your investment portal.</h1>
          <p className="mt-4 max-w-[340px] text-[14px] leading-6 text-white/65">
            Secure access to your Emcoin portfolio, statements, and investment requests.
          </p>
        </div>
        <p className="relative z-10 max-w-[360px] text-[11px] leading-5 text-white/40">
          Emcoin Investment is a licensed investment company. Past performance is not indicative of future results.
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-10">
        <form className="w-full max-w-[380px]" onSubmit={handleSubmit}>
          <img src="/assets/logo-emcoin-official.png" alt="Emcoin Investment" className="mb-8 h-10 w-auto object-contain lg:hidden" />
          <h2 className="font-display text-[24px] font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-[13px] text-slate-500">Sign in to your Emcoin investment portal.</p>

          {error ? (
            <div className="mt-6 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="mt-8">
            <label className="mb-1.5 block text-[12px] font-medium text-slate-700" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="mt-[18px]">
            <label className="mb-1.5 block text-[12px] font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary mt-6 h-[42px] w-full text-[14px]" disabled={submitting} type="submit">
            {submitting ? "Signing in" : "Sign in"}
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-[11px] leading-5 text-slate-500">
            Access is restricted to authorised account holders.
            <br />
            If you need assistance, contact your relationship manager.
          </div>
        </form>
      </section>
    </main>
  );
}
