import { useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { useRecorder } from "../../hooks/useRecorder.js";
import { formatDuration } from "../../utils/format.js";
import { Alert, Button } from "../ui/primitives.jsx";

/** Records an answer and hands the finished recording to `onRecorded`. */
export function MicRecorder({ onRecorded, disabled }) {
  const recorder = useRecorder();
  const { recording, reset } = recorder;

  useEffect(() => {
    if (!recording) return;
    onRecorded(recording);
    reset();
  }, [recording, onRecorded, reset]);

  const isRecording = recorder.status === "recording";
  const remaining = recorder.maxSeconds - recorder.elapsed;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        {isRecording ? (
          <Button variant="danger" size="lg" onClick={recorder.stop}>
            <Square className="size-4" aria-hidden="true" /> Stop recording
          </Button>
        ) : (
          <Button size="lg" onClick={recorder.start} disabled={disabled} loading={recorder.status === "requesting"}>
            <Mic className="size-4" aria-hidden="true" /> {recorder.status === "requesting" ? "Allow microphone…" : "Start recording"}
          </Button>
        )}
        {isRecording && (
          <div className="flex flex-1 items-center gap-3" role="status" aria-live="polite">
            <span className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
              <span className="size-2.5 animate-pulse rounded-full bg-rose-500" aria-hidden="true" /> Recording
            </span>
            <span className="font-mono text-sm tabular-nums text-slate-700">{formatDuration(recorder.elapsed)}</span>
            <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className="h-2 rounded-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${Math.round(recorder.level * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
      {isRecording && remaining <= 30 && (
        <p className="text-sm text-amber-700">Recording stops automatically in {Math.ceil(remaining)} s.</p>
      )}
      {recorder.error && <Alert tone="warning">{recorder.error}</Alert>}
    </div>
  );
}
