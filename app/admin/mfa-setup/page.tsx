"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Copy, ShieldCheck } from "lucide-react";
import { roleHome, useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api/client";
import { LoadingState } from "@/components/ui/state";

type SetupResponse = {
  otpauthUrl: string;
  qrDataUrl: string;
  message: string;
};

type StateResponse = {
  mfaEnabled: boolean;
  hasSecret: boolean;
};

function extractSecret(otpauthUrl: string): string | null {
  try {
    const url = new URL(otpauthUrl);
    return url.searchParams.get("secret");
  } catch {
    return null;
  }
}

export default function MfaSetupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const isRequired = search.get("reason") === "required";

  const [state, setState] = useState<StateResponse | null>(null);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    apiRequest<StateResponse>("/auth/mfa/state")
      .then(setState)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load MFA state"));
  }, [loading, user, router]);

  async function startSetup() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiRequest<SetupResponse>("/auth/mfa/setup", { method: "POST" });
      setSetup(data);
      setSecret(extractSecret(data.otpauthUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code })
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (loading || !state) return <LoadingState label="Loading MFA setup" />;

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle className="h-8 w-8" />
        </div>
        <h1 className="page-title">MFA enrolled successfully</h1>
        <p className="text-[13px] text-slate-500">
          You will be asked for a 6-digit code from your authenticator app on every login.
          Keep your authenticator app safe; if you lose it, contact a super_admin to reset MFA for your account.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => router.replace(user ? roleHome(user.role) : "/login")}
        >
          Continue
        </button>
      </div>
    );
  }

  if (state.mfaEnabled) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="page-title">MFA is already enabled</h1>
        <p className="text-[13px] text-slate-500">
          Your account is protected by two-factor authentication.
        </p>
        <button
          className="btn btn-secondary"
          onClick={() => router.replace(user ? roleHome(user.role) : "/login")}
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="page-title">Set up two-factor authentication</h1>
        <p className="mt-2 text-[13px] text-slate-500">
          {isRequired ? "Two-factor authentication is required for your role." : "Add an extra layer of security to your account."}
        </p>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {!setup ? (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Step 1: Begin enrollment</div>
          </div>
          <div className="space-y-4 p-5 text-[13px] text-slate-700">
            <p>You will need an authenticator app (Google Authenticator, Authy, 1Password, etc.) installed on your phone or device.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Click <strong>Generate code</strong> below.</li>
              <li>Scan the QR code with your authenticator app, or enter the secret manually.</li>
              <li>Enter the 6-digit code your app shows to confirm.</li>
            </ol>
            <button className="btn btn-primary" onClick={startSetup} disabled={submitting}>
              {submitting ? "Generating..." : "Generate code"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Step 2: Scan or enter secret</div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-[200px_1fr]">
              <div className="flex items-start justify-center">
                <img
                  src={setup.qrDataUrl}
                  alt="MFA QR code"
                  className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2"
                />
              </div>
              <div className="space-y-3 text-[13px] text-slate-700">
                <p>Scan the QR code with your authenticator app.</p>
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Or enter manually</div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-700">
                      {secret ?? "—"}
                    </code>
                    {secret ? (
                      <button
                        type="button"
                        onClick={copySecret}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Copy className="inline h-3 w-3" /> {copied ? "Copied" : "Copy"}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Time-based, 30s steps, 6 digits, SHA-1.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={verify} className="card">
            <div className="card-header">
              <div className="card-title">Step 3: Confirm with a code</div>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-[13px] text-slate-700">
                Enter the current 6-digit code from your authenticator app to activate MFA.
              </p>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-slate-900 placeholder-slate-300 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setSetup(null); setCode(""); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || code.length !== 6}
                >
                  {submitting ? "Verifying..." : "Verify and activate"}
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
