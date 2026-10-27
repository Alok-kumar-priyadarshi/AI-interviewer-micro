import { useCallback, useState } from "react";
import { Keyboard, Mic, RotateCcw, Send } from "lucide-react";
import { transcribe } from "../../api/resources.js";
import { isRecordingSupported } from "../../hooks/useRecorder.js";
import { useSettingsStore } from "../../store/settingsStore.js";
import { errorMessage } from "../../utils/errorMessages.js";
import { Alert, Button, Card, Spinner } from "../ui/primitives.jsx";
import { MicRecorder } from "./MicRecorder.jsx";

const MAX_CHARS = 4000;

/**
 * Collects one answer, typed or spoken. Spoken answers are transcribed, shown for correction,
 * and submitted as text with answerMode "voice" plus Whisper's original transcript.
 * Remount it (key) per question so drafts never leak between questions.
 */
export function AnswerPanel({ onSubmit, disabled, skillsHint }) {
  const voiceSupported = isRecordingSupported();
  const preferred = useSettingsStore((s) => s.answerMode);
  const setPreferred = useSettingsStore((s) => s.setAnswerMode);
  const [mode, setMode] = useState(voiceSupported ? preferred : "text");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(null); // { transcriptRaw, durationSec }
  const [transcribing, setTranscribing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const switchMode = (next) => {
    setMode(next);
    setPreferred(next);
    setError(null);
  };

  const handleRecorded = useCallback(
    async ({ blob, durationSec }) => {
      setTranscribing(true);
      setError(null);
      try {
        const result = await transcribe(blob, skillsHint);
        setVoice({ transcriptRaw: result.text, durationSec: result.durationSec ?? durationSec });
        setText(result.text);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setTranscribing(false);
      }
    },
    [skillsHint],
  );

  const submit = async () => {
    const answerText = text.trim();
    if (!answerText) return;
    setSubmitting(true);
    setError(null);
    try {
      const isVoice = mode === "voice" && voice;
      await onSubmit({
        answerText,
        answerMode: isVoice ? "voice" : "text",
        ...(isVoice ? { transcriptRaw: voice.transcriptRaw, audioDurationSec: voice.durationSec } : {}),
      });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const busy = disabled || submitting || transcribing;
  const showEditor = mode === "text" || voice;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Your answer</h2>
        <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Answer mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "text"}
            onClick={() => switchMode("text")}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${mode === "text" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            <Keyboard className="size-4" aria-hidden="true" /> Type
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "voice"}
            onClick={() => switchMode("voice")}
            disabled={busy || !voiceSupported}
            title={voiceSupported ? undefined : "Voice answers are not supported in this browser"}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${mode === "voice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            <Mic className="size-4" aria-hidden="true" /> Speak
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {mode === "voice" && !voice && (
          transcribing ? (
            <Spinner className="size-5 text-indigo-600" label="Transcribing your answer…" />
          ) : (
            <MicRecorder onRecorded={handleRecorded} disabled={busy} />
          )
        )}

        {showEditor && (
          <div>
            {mode === "voice" && (
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-slate-600">Check the transcript and fix anything misheard.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setVoice(null);
                    setText("");
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden="true" /> Re-record
                </Button>
              </div>
            )}
            <label htmlFor="answer" className="sr-only">
              Answer
            </label>
            <textarea
              id="answer"
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_CHARS))}
              rows={7}
              disabled={busy}
              placeholder="Type your answer as you would say it in an interview…"
              className="block w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed shadow-sm focus:outline-2 focus:outline-indigo-600"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit();
              }}
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>Ctrl + Enter to submit</span>
              <span>
                {text.length}/{MAX_CHARS}
              </span>
            </div>
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        {showEditor && (
          <div className="flex justify-end">
            <Button onClick={submit} disabled={!text.trim() || busy} loading={submitting}>
              <Send className="size-4" aria-hidden="true" /> Submit answer
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
