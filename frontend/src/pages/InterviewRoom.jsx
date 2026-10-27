import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, MessageSquareText } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "../api/client.js";
import { answerTurn, endInterview, getInterview, streamNextQuestion } from "../api/resources.js";
import { AnswerPanel } from "../components/interview/AnswerPanel.jsx";
import { QuestionCard } from "../components/interview/QuestionCard.jsx";
import { Alert, Badge, Button, Card, ConfirmDialog, FullPageSpinner, Spinner } from "../components/ui/primitives.jsx";
import { useSpeaker } from "../hooks/useSpeaker.js";
import { errorMessage } from "../utils/errorMessages.js";
import { CATEGORY_LABELS, LEVEL_LABELS } from "../utils/format.js";

const BLOCKED_NOTICE = "Your last answer contained instructions to the AI and wasn't evaluated. Please answer the questions directly.";

function ProgressBar({ meta }) {
  if (!meta) return null;
  const done = meta.planItem;
  const pct = Math.round((done / meta.totalItems) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>
          Topic {meta.planItem + 1} of {meta.totalItems}
        </span>
        <span>{pct}% complete</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-slate-200" aria-hidden="true">
        <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function InterviewRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const speaker = useSpeaker();
  const { speak, stop } = speaker;
  const interview = useQuery({ queryKey: ["interview", id], queryFn: () => getInterview(id), staleTime: Infinity });

  const [phase, setPhase] = useState("streaming"); // streaming | answering | ending | error
  const [question, setQuestion] = useState({ text: "", turnId: null, meta: null });
  const [history, setHistory] = useState(null);
  const [problem, setProblem] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const abortRef = useRef(null);
  // Latest speak() without making loadNext depend on it (voices load late and would restart it).
  const speakRef = useRef(speak);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  const finish = useCallback(async () => {
    abortRef.current?.abort();
    stop();
    setConfirmEnd(false);
    setPhase("ending");
    setProblem(null);
    try {
      await endInterview(id);
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      navigate(`/reports/${id}`, { replace: true });
    } catch (err) {
      setProblem({ message: errorMessage(err), action: "finish" });
      setPhase("error");
    }
  }, [id, navigate, queryClient, stop]);

  // Opens the question stream. It only sets state from stream callbacks; callers that need the
  // previous question cleared first call resetForNext() (the initial state is already clear).
  const loadNext = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let done = null;
    let failure = null;
    try {
      await streamNextQuestion(
        id,
        (event) => {
          if (event.type === "start") setQuestion((q) => ({ ...q, meta: event }));
          else if (event.type === "delta") setQuestion((q) => ({ ...q, text: q.text + event.text }));
          else if (event.type === "replace") setQuestion((q) => ({ ...q, text: event.questionText }));
          else if (event.type === "done") done = event;
          else if (event.type === "error") failure = event;
        },
        controller.signal,
      );
      if (!done) throw new ApiError(503, failure?.code ?? "AI_BUSY", failure?.message ?? "The AI is busy right now.");
      setQuestion((q) => ({ ...q, text: done.questionText, turnId: done.turnId }));
      setPhase("answering");
      speakRef.current(done.questionText);
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (err?.code === "NO_MORE_QUESTIONS" || err?.code === "SESSION_COMPLETED") {
        finish();
        return;
      }
      setProblem({ message: errorMessage(err), action: "next" });
      setPhase("error");
    }
  }, [id, finish]);

  const resetForNext = () => {
    setPhase("streaming");
    setProblem(null);
    setQuestion({ text: "", turnId: null, meta: null });
  };

  const retry = () => {
    if (problem?.action === "finish") return finish();
    resetForNext();
    return loadNext();
  };

  // Start once the session is loaded: completed interviews go straight to their report.
  // The server re-sends an unanswered question, so a repeated start never skips one.
  useEffect(() => {
    if (!interview.data) return undefined;
    if (interview.data.session.status === "completed") {
      navigate(`/reports/${id}`, { replace: true });
      return undefined;
    }
    // Syncing with an external system (the question stream); loadNext only sets state from
    // stream callbacks after an await, never synchronously in this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNext();
    return () => abortRef.current?.abort();
  }, [interview.data, id, navigate, loadNext]);

  const answered = history ?? (interview.data?.turns ?? []).filter((t) => t.answeredAt);

  const submitAnswer = async (payload) => {
    stop();
    const result = await answerTurn(id, question.turnId, payload);
    setHistory([...answered, { ...payload, id: question.turnId, questionText: question.text, category: question.meta?.category }]);
    setNotice(result.blocked ? BLOCKED_NOTICE : null);
    if (result.action === "complete") {
      finish();
      return;
    }
    resetForNext();
    loadNext();
  };

  if (interview.isLoading) return <FullPageSpinner label="Loading interview…" />;
  if (interview.error) return <Alert>{errorMessage(interview.error)}</Alert>;

  const { session } = interview.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900">Mock interview</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge tone="indigo">{LEVEL_LABELS[session.level]}</Badge>
            <span className="min-w-0 max-w-full truncate">{session.resumeName ?? session.candidateName}</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfirmEnd(true)} disabled={phase === "ending"}>
          <Flag className="size-4" aria-hidden="true" /> End interview
        </Button>
      </div>

      <ProgressBar meta={question.meta} />

      {notice && <Alert tone="warning">{notice}</Alert>}

      {phase === "ending" ? (
        <Card className="py-12 text-center">
          <Spinner className="size-6 text-indigo-600" label="Writing your detailed report…" />
          <p className="mt-2 text-xs text-slate-500">This usually takes 10 to 20 seconds.</p>
        </Card>
      ) : (
        <>
          <QuestionCard text={question.text} meta={question.meta} streaming={phase === "streaming"} speaker={speaker} />
          {problem && (
            <Alert
              action={
                <Button size="sm" variant="secondary" onClick={retry}>
                  Retry
                </Button>
              }
            >
              {problem.message}
            </Alert>
          )}
          {phase === "answering" && question.turnId && (
            <AnswerPanel key={question.turnId} onSubmit={submitAnswer} skillsHint={session.skills?.join(", ")} />
          )}
        </>
      )}

      {answered.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
            <MessageSquareText className="size-4" aria-hidden="true" /> Transcript so far ({answered.length})
          </summary>
          <ol className="mt-4 space-y-4">
            {answered.map((turn, i) => (
              <li key={turn.id ?? i} className="text-sm">
                <p className="font-medium wrap-anywhere text-slate-900">
                  {i + 1}. {turn.questionText}{" "}
                  {turn.category && <span className="text-xs font-normal text-slate-500">({CATEGORY_LABELS[turn.category]})</span>}
                </p>
                <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-slate-600">{turn.answerText}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      <ConfirmDialog
        open={confirmEnd}
        title="End the interview now?"
        confirmLabel="End and see report"
        onCancel={() => setConfirmEnd(false)}
        onConfirm={finish}
      >
        Your report will cover the questions you have answered so far.
      </ConfirmDialog>
    </div>
  );
}
