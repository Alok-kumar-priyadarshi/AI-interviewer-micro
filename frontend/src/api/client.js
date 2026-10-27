import { useAuthStore } from "../store/authStore.js";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postRefresh() {
  return fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "same-origin" });
}

let refreshInFlight = null;

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request.
 * A REFRESH_INVALID right after another tab rotated the cookie is retried once.
 * Returns the new token, or null (and clears the session) when the user must log in again.
 */
export function refreshSession() {
  refreshInFlight ??= (async () => {
    try {
      let res = await postRefresh();
      if (res.status === 401) {
        const body = await res.clone().json().catch(() => null);
        if (body?.error?.code === "REFRESH_INVALID") {
          await sleep(300);
          res = await postRefresh();
        }
      }
      if (!res.ok) {
        useAuthStore.getState().clear();
        return null;
      }
      // The refresh response includes the user, so a page load needs no separate /me call.
      const { accessToken, user } = await res.json();
      if (user) useAuthStore.getState().setSession({ user, accessToken });
      else useAuthStore.getState().setAccessToken(accessToken);
      return accessToken;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request(path, { method = "GET", body, formData, signal, raw = false, retry = true } = {}) {
  const headers = {};
  const token = useAuthStore.getState().accessToken;
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (formData) payload = formData;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload, signal, credentials: "same-origin" });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and retry.");
  }

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    const data = await res.clone().json().catch(() => null);
    if (["TOKEN_EXPIRED", "TOKEN_INVALID"].includes(data?.error?.code) && (await refreshSession())) {
      return request(path, { method, body, formData, signal, raw, retry: false });
    }
  }

  if (raw && res.ok) return res;
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data?.error ?? {};
    throw new ApiError(res.status, error.code ?? "INTERNAL_ERROR", error.message ?? "Something went wrong", error.details);
  }
  return data;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
  upload: (path, formData, options) => request(path, { ...options, method: "POST", formData }),
  /** POST that returns the raw Response so the caller can read a stream. */
  stream: (path, options) => request(path, { ...options, method: "POST", raw: true }),
};
