const tokenKey = "emcoin.accessToken";

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(tokenKey);
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(tokenKey, token);
}

export function clearStoredToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(tokenKey);
  }
}
