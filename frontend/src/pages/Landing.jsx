import { FileText, Gauge, MessagesSquare, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "../components/layout/AppShell.jsx";
import { buttonClasses } from "../components/ui/buttonClasses.js";
import { useAuthStore } from "../store/authStore.js";

const FEATURES = [
  {
    icon: FileText,
    title: "Built from your resume",
    text: "Share a public Google Drive link. Questions come from your real projects and the stack you list.",
  },
  {
    icon: Gauge,
    title: "Three difficulty levels",
    text: "Low for fundamentals, medium for trade-offs, high for deep dives, scale and edge cases.",
  },
  {
    icon: MessagesSquare,
    title: "Speak or type",
    text: "Every question is shown and read aloud. Answer by voice or keyboard, question by question.",
  },
  {
    icon: ShieldCheck,
    title: "Honest, detailed report",
    text: "Scores per category, every question and answer, what an ideal answer covers, and your progress.",
  },
];

const STEPS = ["Add your resume link", "Pick a level and length", "Answer like a real interview", "Read your report"];

export default function Landing() {
  const status = useAuthStore((s) => s.status);
  const signedIn = status === "authenticated";

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo compact />
        <nav className="flex items-center gap-2">
          {signedIn ? (
            <Link to="/dashboard" className={buttonClasses()}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonClasses({ variant: "ghost", className: "whitespace-nowrap" })}>
                Log in
              </Link>
              <Link to="/signup" className={buttonClasses({ className: "whitespace-nowrap" })}>
                Sign up free
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-12 text-center sm:pt-20">
          <p className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            Free AI interview practice
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Rehearse your next technical interview with an AI that read your resume
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Realistic questions about your projects and skills, spoken or typed answers, and a detailed review at the
            end.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={signedIn ? "/interviews/new" : "/signup"} className={buttonClasses({ size: "lg" })}>
              Start practising
            </Link>
            {!signedIn && (
              <Link to="/login" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                I already have an account
              </Link>
            )}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4" aria-label="Features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Icon className="size-6 text-indigo-600" aria-hidden="true" />
              <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-24" aria-label="How it works">
          <h2 className="text-center text-2xl font-bold text-slate-900">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step} className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-200">
                <span className="mx-auto flex size-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-3 text-sm font-medium text-slate-800">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
