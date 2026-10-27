import { create } from "zustand";

/**
 * The access token lives only in memory (never localStorage), so an XSS bug cannot read it
 * from storage. A page reload restores the session from the httpOnly refresh cookie.
 * status: "loading" until the first refresh attempt finishes, then "authenticated" | "anonymous".
 */
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  status: "loading",
  setSession: ({ user, accessToken }) => set({ user, accessToken, status: "authenticated" }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: () => set({ user: null, accessToken: null, status: "anonymous" }),
}));
