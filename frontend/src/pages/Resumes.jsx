import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Play, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { deleteResume, listResumes } from "../api/resources.js";
import { DriveLinkInput } from "../components/resume/DriveLinkInput.jsx";
import { ResumeCard } from "../components/resume/ResumeCard.jsx";
import { buttonClasses } from "../components/ui/buttonClasses.js";
import { Alert, Button, Card, ConfirmDialog, EmptyState, FullPageSpinner } from "../components/ui/primitives.jsx";
import { errorMessage } from "../utils/errorMessages.js";

export default function Resumes() {
  const queryClient = useQueryClient();
  const resumes = useQuery({ queryKey: ["resumes"], queryFn: listResumes });
  const [toDelete, setToDelete] = useState(null);
  const remove = useMutation({
    mutationFn: deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      setToDelete(null);
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your resumes</h1>
        <p className="mt-1 text-sm text-slate-600">Interviews are built from the projects and skills in these resumes.</p>
      </div>

      <Card>
        <DriveLinkInput />
        <p className="mt-3 text-xs text-slate-500">
          In Google Drive: Share → General access → "Anyone with the link" → Copy link. Adding the same file again
          refreshes its analysis.
        </p>
      </Card>

      {resumes.isLoading && <FullPageSpinner label="Loading resumes…" />}
      {resumes.error && <Alert>{errorMessage(resumes.error)}</Alert>}
      {resumes.data?.length === 0 && (
        <EmptyState icon={FileText} title="No resumes yet">
          Paste a public Google Drive link above to add your first resume.
        </EmptyState>
      )}
      {resumes.data?.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {resumes.data.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              actions={
                <>
                  <Link to={`/interviews/new?resumeId=${resume.id}`} className={buttonClasses({ size: "sm" })}>
                    <Play className="size-4" aria-hidden="true" /> Start interview
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => setToDelete(resume)}>
                    <Trash2 className="size-4" aria-hidden="true" /> Delete
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this resume?"
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => remove.mutate(toDelete.id)}
      >
        Past interviews and reports stay available. You can add the resume again at any time.
        {remove.error && <span className="mt-2 block text-rose-700">{errorMessage(remove.error)}</span>}
      </ConfirmDialog>
    </div>
  );
}
