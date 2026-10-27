import { Navigate, Outlet, useLocation } from "react-router";
import { FullPageSpinner } from "../components/ui/primitives.jsx";
import { useAuthStore } from "../store/authStore.js";

/** Pages that need a logged-in user. Waits for the session restore before deciding. */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner label="Restoring your session…" />;
  if (status !== "authenticated") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Login and signup: a logged-in user goes straight to the dashboard. */
export function PublicOnlyRoute() {
  const status = useAuthStore((s) => s.status);
  if (status === "loading") return <FullPageSpinner />;
  if (status === "authenticated") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
