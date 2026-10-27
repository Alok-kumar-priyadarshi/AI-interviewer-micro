import { useAuthStore } from "../store/authStore.js";
import { api, refreshSession } from "./client.js";

export async function signup(input) {
  const session = await api.post("/auth/signup", input);
  useAuthStore.getState().setSession(session);
  return session.user;
}

export async function login(input) {
  const session = await api.post("/auth/login", input);
  useAuthStore.getState().setSession(session);
  return session.user;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    useAuthStore.getState().clear();
  }
}

/** Restores the session after a page load using the refresh cookie. */
export async function bootstrapSession() {
  const token = await refreshSession();
  if (!token || useAuthStore.getState().user) return;
  // Older auth-service versions don't return the user from /refresh.
  try {
    const { user } = await api.get("/auth/me");
    useAuthStore.getState().setSession({ user, accessToken: useAuthStore.getState().accessToken });
  } catch {
    useAuthStore.getState().clear();
  }
}
