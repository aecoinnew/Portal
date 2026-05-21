import { clearStoredToken, getStoredToken } from "@/lib/auth/storage";
import type { ApiErrorBody } from "@/lib/types/domain";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
  }
}

type RequestOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token ?? getStoredToken();
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      error: { message: "Request failed" }
    }))) as ApiErrorBody;

    if (response.status === 401 || body.error.code === "account_suspended") {
      clearStoredToken();
    }

    throw new ApiClientError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function downloadFromApi(path: string, fileName: string) {
  const token = getStoredToken();
  const response = await fetch(`${apiUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      error: { message: "Download failed" }
    }))) as ApiErrorBody;
    throw new ApiClientError(response.status, body);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
