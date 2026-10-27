import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { addResume } from "../../api/resources.js";
import { errorMessage } from "../../utils/errorMessages.js";
import { Alert, Button } from "../ui/primitives.jsx";

const STAGES = ["Checking the link…", "Downloading your resume…", "Reading your resume…", "Analyzing your experience…"];

/** Rotates through progress text while a long request runs. */
function useStagedText(active) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2500);
    return () => {
      clearInterval(timer);
      setStage(0);
    };
  }, [active]);
  return STAGES[stage];
}

/** Paste a Google Drive link → resume-service validates, parses and analyzes it. */
export function DriveLinkInput({ onAdded }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [localError, setLocalError] = useState(null);
  const inputRef = useRef(null);
  const mutation = useMutation({
    mutationFn: addResume,
    onSuccess: (resume) => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      setUrl("");
      onAdded?.(resume);
    },
    // Put the cursor back in the box so the user can fix the link straight away.
    onError: () => inputRef.current?.focus(),
  });

  const onChange = (event) => {
    setUrl(event.target.value);
    // Editing the link clears the previous error.
    setLocalError(null);
    if (mutation.isError) mutation.reset();
  };
  const stageText = useStagedText(mutation.isPending);

  const onSubmit = (event) => {
    event.preventDefault();
    setLocalError(null);
    const value = url.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) {
      setLocalError("Not a valid URL");
      inputRef.current?.focus();
      return;
    }
    mutation.mutate(value);
  };

  const error = localError ?? (mutation.error ? errorMessage(mutation.error) : null);

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <label htmlFor="drive-url" className="block text-sm font-medium text-slate-800">
        Google Drive link to your resume (PDF or DOCX, shared as "Anyone with the link")
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          {/* readOnly (not disabled) while analyzing, so the box keeps focus and is editable again
              the moment the request finishes. */}
          <input
            ref={inputRef}
            id="drive-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={onChange}
            placeholder="https://drive.google.com/file/d/…/view"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "drive-url-error" : undefined}
            aria-busy={mutation.isPending}
            readOnly={mutation.isPending}
            className={`block w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm shadow-sm focus:outline-2 focus:outline-indigo-600 ${mutation.isPending ? "bg-slate-50 text-slate-500" : "bg-white"} ${error ? "border-rose-400" : "border-slate-300"}`}
          />
        </div>
        <Button type="submit" loading={mutation.isPending} disabled={!url.trim()}>
          {mutation.isPending ? "Analyzing" : "Analyze resume"}
        </Button>
      </div>
      {mutation.isPending && (
        <p className="text-sm text-slate-600" role="status" aria-live="polite">
          {stageText}
        </p>
      )}
      {error && (
        <div id="drive-url-error">
          <Alert>{error}</Alert>
        </div>
      )}
    </form>
  );
}
