import { useState } from "react";
import { LogOut, Menu, Mic, X } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { logout } from "../../api/auth.js";
import { useAuthStore } from "../../store/authStore.js";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/resumes", label: "Resumes" },
  { to: "/interviews/new", label: "New interview" },
];

/** `compact`: show only the icon on phones (for headers that also hold buttons). */
export function Logo({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap text-slate-900">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
        <Mic className="size-4" aria-hidden="true" />
      </span>
      <span className={compact ? "sr-only sm:not-sr-only" : ""}>AI Mock Interviewer</span>
    </span>
  );
}

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`;

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" aria-label="Dashboard">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass} end>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm text-slate-600">{user?.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="size-4" aria-hidden="true" /> Log out
            </button>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-slate-200 px-4 py-3 md:hidden" aria-label="Mobile">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClass} end onClick={() => setOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
              <button type="button" onClick={handleLogout} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100">
                Log out ({user?.name})
              </button>
            </div>
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <footer className="no-print border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Practice makes progress. Your audio is never stored.
      </footer>
    </div>
  );
}
