import { Pause, Volume2, VolumeX } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore.js";
import { CATEGORY_LABELS } from "../../utils/format.js";
import { Badge, Button, Card } from "../ui/primitives.jsx";

/** The current question: streamed text, its category, and read-aloud controls. */
export function QuestionCard({ text, meta, streaming, speaker }) {
  const muted = useSettingsStore((s) => s.muted);
  const setMuted = useSettingsStore((s) => s.setMuted);

  return (
    <Card className="border-indigo-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {meta && <Badge tone="indigo">{CATEGORY_LABELS[meta.category]}</Badge>}
          {meta?.isFollowUp && <Badge tone="amber">Follow-up</Badge>}
        </div>
        {speaker.supported && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={streaming || !text}
              onClick={() => (speaker.speaking ? speaker.stop() : speaker.speak(text, { force: true }))}
              aria-label={speaker.speaking ? "Stop reading" : "Read question aloud"}
            >
              {speaker.speaking ? <Pause className="size-4" /> : <Volume2 className="size-4" />}
              <span className="hidden sm:inline">{speaker.speaking ? "Stop" : "Replay"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!muted) speaker.stop();
                setMuted(!muted);
              }}
              aria-pressed={muted}
              aria-label={muted ? "Turn auto-read on" : "Turn auto-read off"}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-indigo-600" />}
              <span className="hidden sm:inline">{muted ? "Auto-read off" : "Auto-read on"}</span>
            </Button>
          </div>
        )}
      </div>
      <p className="mt-4 min-h-16 text-lg font-medium leading-relaxed text-slate-900 sm:text-xl" aria-live="polite" aria-busy={streaming}>
        {text}
        {streaming && <span className="ml-1 inline-block h-5 w-2 animate-pulse rounded-sm bg-indigo-400 align-middle" aria-hidden="true" />}
        {!text && streaming && <span className="text-slate-400">Your interviewer is thinking…</span>}
      </p>
    </Card>
  );
}
