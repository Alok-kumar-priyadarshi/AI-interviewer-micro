const MAX_CHUNK_CHARS = 1400; // about 350 tokens
const OVERLAP_CHARS = 200;
const MAX_CHUNKS = 40;

function splitLong(chunk) {
  if (chunk.content.length <= MAX_CHUNK_CHARS) return [chunk];
  const parts = [];
  for (let start = 0; start < chunk.content.length; start += MAX_CHUNK_CHARS - OVERLAP_CHARS) {
    parts.push({ ...chunk, content: chunk.content.slice(start, start + MAX_CHUNK_CHARS) });
    if (start + MAX_CHUNK_CHARS >= chunk.content.length) break;
  }
  return parts;
}

const bullets = (items) => (items ?? []).map((item) => `- ${item}`);
const range = (start, end) => [start, end].filter(Boolean).join(" to ");

/**
 * Builds retrieval chunks: one per project, one per job, plus summary, skills, education and
 * certifications. Falls back to plain text windows when the profile came back nearly empty.
 */
export function buildChunks(profile, rawText) {
  const chunks = [];
  const add = (section, title, lines) => {
    const content = lines.filter(Boolean).join("\n").trim();
    if (content) chunks.push(...splitLong({ section, title: title?.slice(0, 200) ?? null, content }));
  };

  add("summary", profile.name ?? "Summary", [
    profile.headline,
    profile.yearsOfExperience != null ? `${profile.yearsOfExperience} years of experience` : null,
    profile.primaryDomain ? `Primary domain: ${profile.primaryDomain}` : null,
  ]);

  const skills = profile.skills ?? {};
  add(
    "skills",
    "Skills",
    Object.entries(skills)
      .filter(([, items]) => items?.length)
      .map(([group, items]) => `${group[0].toUpperCase()}${group.slice(1)}: ${items.join(", ")}`),
  );

  for (const project of profile.projects ?? []) {
    add("project", project.name, [
      project.role ? `Role: ${project.role}` : null,
      project.stack?.length ? `Stack: ${project.stack.join(", ")}` : null,
      project.description,
      ...bullets(project.highlights),
    ]);
  }

  for (const job of profile.experience ?? []) {
    add("experience", `${job.title} at ${job.company}`, [range(job.start, job.end), ...bullets(job.highlights)]);
  }

  add(
    "education",
    "Education",
    (profile.education ?? []).map((e) =>
      [e.degree, e.field, e.institution, range(e.start, e.end)].filter(Boolean).join(", "),
    ),
  );

  if (profile.certifications?.length) add("other", "Certifications", bullets(profile.certifications));

  if (chunks.length < 3 && rawText) add("other", "Resume text", [rawText]);

  return chunks.slice(0, MAX_CHUNKS).map((chunk) => ({
    ...chunk,
    tokenCount: Math.ceil(chunk.content.length / 4),
    embedText: `${chunk.section}: ${chunk.title ?? ""}\n${chunk.content}`,
  }));
}
