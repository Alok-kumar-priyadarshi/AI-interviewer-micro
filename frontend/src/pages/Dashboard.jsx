import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { endInterview, listInterviews, listReports } from "../api/resources.js";
import { TrendLine } from "../components/report/Charts.jsx";
import { buttonClasses } from "../components/ui/buttonClasses.js";
import { Alert, Badge, Button, Card, EmptyState, FullPageSpinner } from "../components/ui/primitives.jsx";
import { useAuthStore } from "../store/authStore.js";
import { errorMessage } from "../utils/errorMessages.js";
import { formatDate, LEVEL_LABELS, scoreTone, STATUS_LABELS } from "../utils/format.js";

const STATUS_TONES = { completed: "emerald", in_progress: "sky", created: "slate", abandoned: "amber" };

function InterviewRow({ session, report }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const generate = useMutation({
    mutationFn: () => endInterview(session.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      navigate(`/reports/${session.id}`);
    },
  });

  let action;
  if (report) {
    action = (
      <Link to={`/reports/${session.id}`} className={buttonClasses({ size: "sm" })}>
        View report
      </Link>
    );
  } else if (session.status === "completed") {
    action = (
      <Button size="sm" variant="secondary" loading={generate.isPending} onClick={() => generate.mutate()}>
        Generate report
      </Button>
    );
  } else {
    action = (
      <Link to={`/interviews/${session.id}`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
        {session.status === "created" ? "Start" : "Continue"}
      </Link>
    );
  }

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{session.resumeName ?? session.candidateName ?? "Interview"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{formatDate(session.createdAt)}</span>
          <Badge tone="indigo">{LEVEL_LABELS[session.level]}</Badge>
          <span>{session.questionCount} questions</span>
          <Badge tone={STATUS_TONES[session.status]}>{STATUS_LABELS[session.status]}</Badge>
        </div>
        {generate.error && <p className="mt-1 text-xs text-rose-700">{errorMessage(generate.error)}</p>}
      </div>
      <div className="flex items-center gap-4">
        {report && (
          <span className={`text-lg font-bold ${scoreTone(report.overallScore, 100)}`}>
            {report.overallScore ?? "–"}
            <span className="text-xs font-normal text-slate-500">/100</span>
          </span>
        )}
        {action}
      </div>
    </li>
  );
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const interviews = useQuery({ queryKey: ["interviews"], queryFn: listInterviews });
  const reports = useQuery({ queryKey: ["reports"], queryFn: listReports });

  if (interviews.isLoading || reports.isLoading) return <FullPageSpinner label="Loading your interviews…" />;

  const reportsBySession = new Map((reports.data ?? []).map((r) => [r.sessionId, r]));
  const trend = [...(reports.data ?? [])].reverse().map((r) => ({ sessionId: r.sessionId, overall: r.overallScore }));
  const scored = (reports.data ?? []).filter((r) => r.overallScore != null);
  const best = scored.length ? Math.max(...scored.map((r) => r.overallScore)) : null;
  const latest = scored[0]?.overallScore ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hi {user?.name?.split(" ")[0] ?? "there"}</h1>
          <p className="mt-1 text-sm text-slate-600">Pick up where you left off or start a new interview.</p>
        </div>
        <Link to="/interviews/new" className={buttonClasses()}>
          <Plus className="size-4" aria-hidden="true" /> New interview
        </Link>
      </div>

      {(interviews.error || reports.error) && <Alert>{errorMessage(interviews.error ?? reports.error)}</Alert>}

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card padding="p-3 sm:p-6">
          <p className="text-xs text-slate-500 sm:text-sm">Interviews</p>
          <p className="mt-1 text-2xl font-bold sm:text-3xl text-slate-900">{interviews.data?.length ?? 0}</p>
        </Card>
        <Card padding="p-3 sm:p-6">
          <p className="text-xs text-slate-500 sm:text-sm">Latest score</p>
          <p className={`mt-1 text-3xl font-bold ${scoreTone(latest, 100)}`}>{latest ?? "–"}</p>
        </Card>
        <Card padding="p-3 sm:p-6">
          <p className="text-xs text-slate-500 sm:text-sm">Best score</p>
          <p className={`mt-1 text-3xl font-bold ${scoreTone(best, 100)}`}>{best ?? "–"}</p>
        </Card>
      </div>

      {trend.length >= 2 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Your progress</h2>
          <p className="text-xs text-slate-500">Overall score per interview, oldest to newest.</p>
          <div className="mt-4">
            <TrendLine points={trend} />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Interview history</h2>
        {interviews.data?.length ? (
          <ul className="divide-y divide-slate-100">
            {interviews.data.map((session) => (
              <InterviewRow key={session.id} session={session} report={reportsBySession.get(session.id)} />
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={ClipboardList}
              title="No interviews yet"
              action={
                <Link to="/interviews/new" className={buttonClasses()}>
                  Start your first interview
                </Link>
              }
            >
              Add your resume and choose a difficulty to begin.
            </EmptyState>
          </div>
        )}
      </Card>
    </div>
  );
}
