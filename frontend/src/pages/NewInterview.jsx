import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { createInterview, listResumes } from "../api/resources.js";
import { LevelPicker, QuestionCountPicker } from "../components/interview/Pickers.jsx";
import { DriveLinkInput } from "../components/resume/DriveLinkInput.jsx";
import { ResumeCard } from "../components/resume/ResumeCard.jsx";
import { Alert, Button, Card, FullPageSpinner } from "../components/ui/primitives.jsx";
import { errorMessage } from "../utils/errorMessages.js";

export default function NewInterview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const resumes = useQuery({ queryKey: ["resumes"], queryFn: listResumes });
  const [chosenId, setChosenId] = useState(params.get("resumeId"));
  const [level, setLevel] = useState("medium");
  const [questionCount, setQuestionCount] = useState(5);

  // Default to the newest resume until the user picks one.
  const resumeId = chosenId ?? resumes.data?.[0]?.id ?? null;

  const start = useMutation({
    mutationFn: createInterview,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      navigate(`/interviews/${session.id}`);
    },
  });

  if (resumes.isLoading) return <FullPageSpinner label="Loading your resumes…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New interview</h1>
        <p className="mt-1 text-sm text-slate-600">Choose a resume, a difficulty and a length.</p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Resume</h2>
        {resumes.data?.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {resumes.data.map((resume) => (
              <ResumeCard key={resume.id} resume={resume} selected={resume.id === resumeId} onSelect={() => setChosenId(resume.id)} />
            ))}
          </div>
        )}
        <div className={resumes.data?.length ? "border-t border-slate-100 pt-4" : ""}>
          <DriveLinkInput onAdded={(resume) => setChosenId(resume.id)} />
        </div>
      </Card>

      <Card className="space-y-6">
        <LevelPicker value={level} onChange={setLevel} />
        <QuestionCountPicker value={questionCount} onChange={setQuestionCount} />
      </Card>

      <Alert tone="info">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Mic className="size-4" aria-hidden="true" /> Tip:
        </span>{" "}
        Questions are read aloud. To answer by voice, allow microphone access when asked. You can switch to typing at
        any time.
      </Alert>

      {start.error && <Alert>{errorMessage(start.error)}</Alert>}

      <div className="flex justify-end">
        <Button size="lg" className="w-full sm:w-auto" disabled={!resumeId} loading={start.isPending} onClick={() => start.mutate({ resumeId, level, questionCount })}>
          {start.isPending ? "Preparing your interview" : "Start interview"}
        </Button>
      </div>
    </div>
  );
}
