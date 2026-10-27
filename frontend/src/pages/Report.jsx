import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Keyboard, Lightbulb, Mic, Printer, ShieldAlert, TrendingUp } from "lucide-react";
import { Link, useParams } from "react-router";
import { endInterview, getReport } from "../api/resources.js";
import { ScoreBar, ScoreRing, TrendLine } from "../components/report/Charts.jsx";
import { Alert, Badge, Button, Card, FullPageSpinner } from "../components/ui/primitives.jsx";
import { errorMessage } from "../utils/errorMessages.js";
import { CATEGORY_LABELS, formatDate, formatDuration, LEVEL_LABELS, scoreTone, signed } from "../utils/format.js";

const CATEGORY_ORDER = ["intro", "project", "technical", "behavioral", "communication"];

function List({ items, empty }) {
  if (!items?.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm wrap-anywhere text-slate-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function AnswerModeBadge({ mode }) {
  if (mode === "voice") {
    return (
      <Badge tone="sky">
        <Mic className="size-3" aria-hidden="true" /> Spoken
      </Badge>
    );
  }
  if (mode === "text") {
    return (
      <Badge tone="slate">
        <Keyboard className="size-3" aria-hidden="true" /> Typed
      </Badge>
    );
  }
  return <Badge tone="amber">Not answered</Badge>;
}

function QAItem({ item, number }) {
  const editedTranscript = item.answerMode === "voice" && item.transcriptRaw && item.transcriptRaw.trim() !== item.answerText?.trim();
  return (
    <li className="print-break-avoid min-w-0 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-500">Q{number}</span>
          <Badge tone="indigo">{CATEGORY_LABELS[item.category]}</Badge>
          {item.isFollowUp && <Badge tone="amber">Follow-up</Badge>}
          <AnswerModeBadge mode={item.answerMode} />
          {item.guardVerdict === "block" && (
            <Badge tone="rose">
              <ShieldAlert className="size-3" aria-hidden="true" /> Not evaluated
            </Badge>
          )}
        </div>
        <span className={`text-lg font-bold ${scoreTone(item.score)}`}>{item.score == null ? "–" : `${item.score}/10`}</span>
      </div>
      <p className="mt-3 font-medium wrap-anywhere text-slate-900">{item.question}</p>
      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Your answer
          {item.answerMode === "voice" && item.audioDurationSec ? ` · ${formatDuration(item.audioDurationSec)} spoken` : ""}
        </p>
        <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-sm text-slate-800">{item.answerText ?? "No answer given."}</p>
        {editedTranscript && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">Original transcript</summary>
            <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-slate-600">{item.transcriptRaw}</p>
          </details>
        )}
      </div>
      {item.rubric && (
        <p className="mt-3 text-xs text-slate-500">
          Correctness {item.rubric.correctness}/10 · Depth {item.rubric.depth}/10 · Communication {item.rubric.communication}/10
        </p>
      )}
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-emerald-700">Strengths</p>
          <List items={item.strengths} empty="—" />
        </div>
        <div>
          <p className="text-xs font-semibold text-rose-700">Gaps</p>
          <List items={item.gaps} empty="—" />
        </div>
        <div>
          <p className="text-xs font-semibold text-indigo-700">An ideal answer covers</p>
          <List items={item.idealAnswerHints} empty="—" />
        </div>
      </div>
    </li>
  );
}

function NotReady({ sessionId }) {
  const queryClient = useQueryClient();
  const generate = useMutation({
    mutationFn: () => endInterview(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report", sessionId] }),
  });
  return (
    <Card className="mx-auto max-w-lg text-center">
      <h1 className="text-lg font-semibold text-slate-900">This report isn't ready yet</h1>
      <p className="mt-2 text-sm text-slate-600">The interview ended but its report was not written. You can generate it now.</p>
      {generate.error && (
        <div className="mt-4 text-left">
          <Alert>{errorMessage(generate.error)}</Alert>
        </div>
      )}
      <div className="mt-5 flex justify-center gap-3">
        <Link to="/dashboard" className="text-sm font-medium text-slate-600 underline">
          Back to dashboard
        </Link>
        <Button onClick={() => generate.mutate()} loading={generate.isPending}>
          Generate report
        </Button>
      </div>
    </Card>
  );
}

export default function Report() {
  const { sessionId } = useParams();
  const query = useQuery({ queryKey: ["report", sessionId], queryFn: () => getReport(sessionId) });

  if (query.isLoading) return <FullPageSpinner label="Loading your report…" />;
  if (query.error?.status === 404) return <NotReady sessionId={sessionId} />;
  if (query.error) return <Alert>{errorMessage(query.error)}</Alert>;

  const { report, items } = query.data;
  const comparison = report.comparison ?? {};
  const answeredItems = items.filter((i) => i.answerText);
  const voiceCount = answeredItems.filter((i) => i.answerMode === "voice").length;

  return (
    <article className="space-y-6">
      <div className="no-print flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" /> Dashboard
        </Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" /> Print / Save as PDF
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-bold text-slate-900">Interview report</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Badge tone="indigo">{LEVEL_LABELS[report.level]} level</Badge>
          <span className="min-w-0 max-w-full truncate">{report.profileSummary?.resumeName ?? report.profileSummary?.name}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(report.endedAt ?? report.createdAt)}</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center text-center">
          <ScoreRing score={report.overallScore} />
          <p className="mt-3 text-sm text-slate-600">
            {report.questionsAnswered} of {items.length} questions answered
            {voiceCount > 0 && ` · ${voiceCount} spoken`}
          </p>
          {comparison.delta != null && (
            <p className={`mt-1 text-sm font-medium ${comparison.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {signed(comparison.delta)} vs your average
            </p>
          )}
        </Card>
        <Card className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Scores by category</h2>
          {CATEGORY_ORDER.filter((c) => report.categoryScores?.[c] !== undefined).map((category) => (
            <ScoreBar
              key={category}
              label={CATEGORY_LABELS[category]}
              score={report.categoryScores[category]}
              delta={comparison.categoryDeltas?.[category]}
            />
          ))}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
        <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-slate-700">{report.summary}</p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-emerald-700">What went well</h2>
          <div className="mt-2">
            <List items={report.strengths} empty="Answer more questions to see your strengths." />
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-rose-700">What to improve</h2>
          {report.improvements?.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {report.improvements.map((item) => (
                <li key={item.topic}>
                  <span className="font-medium text-slate-900">{item.topic}:</span> <span className="text-slate-700">{item.advice}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Nothing to flag.</p>
          )}
        </Card>
      </div>

      {report.recommendedTopics?.length > 0 && (
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Lightbulb className="size-4 text-amber-500" aria-hidden="true" /> Study next
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.recommendedTopics.map((topic) => (
              <Badge key={topic} tone="amber">
                {topic}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {report.integrityNotes?.length > 0 && (
        <Alert tone="warning">
          <p className="font-medium">Integrity notes</p>
          <ul className="mt-1 list-disc pl-5">
            {report.integrityNotes.map((note) => (
              <li key={note.idx}>
                Question {note.idx + 1}: {note.note}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {comparison.previousCount > 0 && (
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <TrendingUp className="size-4 text-indigo-600" aria-hidden="true" /> Your progress
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Compared with your {comparison.previousCount} earlier interview{comparison.previousCount === 1 ? "" : "s"}
            {comparison.previousAverage != null && ` (average ${comparison.previousAverage})`}.
          </p>
          {comparison.trend?.length >= 2 && (
            <div className="mt-4">
              <TrendLine points={comparison.trend} />
            </div>
          )}
          {comparison.recurringWeakTopics?.length > 0 && (
            <p className="mt-3 text-sm text-slate-700">
              <span className="font-medium">Keeps coming up:</span> {comparison.recurringWeakTopics.join(", ")}
            </p>
          )}
        </Card>
      )}

      <section aria-labelledby="qa-heading">
        <h2 id="qa-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Every question and answer
        </h2>
        <ol className="space-y-4">
          {items.map((item, i) => (
            <QAItem key={item.id} item={item} number={i + 1} />
          ))}
        </ol>
      </section>
    </article>
  );
}
