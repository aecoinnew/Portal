// Shared password policy, used by both the API (validation) and the web
// (live strength feedback). Keep this dependency-free so it works in both.

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordCheck = {
  ok: boolean;
  score: number; // 0..4
  failures: string[];
};

/**
 * Enforce a baseline policy: length + 3 of 4 character classes.
 * Returns the list of unmet requirements (empty when acceptable).
 */
export function checkPassword(password: string): PasswordCheck {
  const failures: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    failures.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  if (!hasLower) failures.push("A lowercase letter");
  if (!hasUpper) failures.push("An uppercase letter");
  if (!hasDigit) failures.push("A number");
  if (!hasSymbol) failures.push("A symbol");

  // Acceptable: meets length AND at least 3 of the 4 classes.
  const ok = password.length >= PASSWORD_MIN_LENGTH && classes >= 3;

  // Strength score for UI (0..4).
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 16) score++;
  if (classes >= 3) score++;
  if (classes === 4 && password.length >= 14) score++;

  return { ok, score: Math.min(score, 4), failures: ok ? [] : failures };
}

export function strengthLabel(score: number): string {
  return ["Very weak", "Weak", "Fair", "Good", "Strong"][Math.max(0, Math.min(score, 4))];
}
