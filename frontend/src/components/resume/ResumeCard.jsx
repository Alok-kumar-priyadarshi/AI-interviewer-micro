import { FileText } from "lucide-react";
import { formatDate } from "../../utils/format.js";
import { Badge } from "../ui/primitives.jsx";

/** Summary of an analyzed resume. Works with both the list item and the full resume shape. */
export function ResumeCard({ resume, selected = false, actions, onSelect }) {
  const profile = resume.profile;
  const name = resume.name ?? profile?.name ?? "Unnamed candidate";
  const headline = resume.headline ?? profile?.headline;
  const skills =
    resume.topSkills ??
    [profile?.skills?.languages, profile?.skills?.frameworks, profile?.skills?.databases].flat().filter(Boolean).slice(0, 8);
  const projects = resume.projectNames ?? (profile?.projects ?? []).map((p) => p.name).slice(0, 6);

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{name}</p>
          {headline && <p className="truncate text-sm text-slate-600">{headline}</p>}
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {resume.fileName ?? "Resume"} · added {formatDate(resume.createdAt)}
          </p>
        </div>
      </div>
      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <Badge key={skill} tone="indigo">
              {skill}
            </Badge>
          ))}
        </div>
      )}
      {projects.length > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Projects:</span> {projects.join(", ")}
        </p>
      )}
    </>
  );

  // min-w-0: grid items otherwise grow to fit their truncated text and overflow on phones.
  const frame = `min-w-0 rounded-2xl border bg-white p-4 text-left shadow-sm transition ${selected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"}`;

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} aria-pressed={selected} className={`${frame} w-full hover:border-indigo-300`}>
        {body}
      </button>
    );
  }
  return (
    <div className={frame}>
      {body}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
