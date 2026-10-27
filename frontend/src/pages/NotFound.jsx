import { Link } from "react-router";
import { buttonClasses } from "../components/ui/buttonClasses.js";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you are looking for doesn't exist or was moved.</p>
      <Link to="/" className={buttonClasses({ className: "mt-6" })}>
        Back home
      </Link>
    </div>
  );
}
