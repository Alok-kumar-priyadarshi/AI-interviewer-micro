import { CATEGORIES, CATEGORY_MIX, FALLBACK_TOPICS } from "../lib/levels.js";
import { sanitizeText } from "../lib/sanitize.js";

const SOURCE_SECTIONS = ["summary", "skills", "project", "experience", "education", "other"];

const key = (topic) => topic.trim().toLowerCase();

/**
 * Makes the model's plan exactly match the category mix: cleans every item, drops duplicates,
 * fills missing slots from the resume (unused projects and skills) and then generic topics,
 * and orders it intro → project/technical alternating → behavioral.
 */
export function normalizePlan(items, questionCount, profileSummary) {
  const mix = CATEGORY_MIX[questionCount];
  const used = new Set();
  const buckets = Object.fromEntries(CATEGORIES.map((c) => [c, []]));

  const accept = (category, raw) => {
    const topic = sanitizeText(raw.topic ?? "", 120);
    if (!topic || used.has(key(topic)) || buckets[category].length >= mix[category]) return;
    used.add(key(topic));
    buckets[category].push({
      category,
      topic,
      focus: sanitizeText(raw.focus ?? "", 200) || "experience and reasoning",
      sourceSection: SOURCE_SECTIONS.includes(raw.sourceSection) ? raw.sourceSection : "other",
    });
  };

  for (const item of items ?? []) {
    if (CATEGORIES.includes(item?.category)) accept(item.category, item);
  }

  const fromResume = {
    project: (profileSummary?.projectNames ?? []).map((name) => ({
      topic: name,
      focus: "role, design decisions and challenges",
      sourceSection: "project",
    })),
    technical: (profileSummary?.topSkills ?? []).map((skill) => ({
      topic: skill,
      focus: "fundamentals and practical use",
      sourceSection: "skills",
    })),
  };
  for (const category of CATEGORIES) {
    for (const candidate of [...(fromResume[category] ?? []), ...FALLBACK_TOPICS[category]]) {
      if (buckets[category].length >= mix[category]) break;
      accept(category, candidate);
    }
  }

  const ordered = [...buckets.intro];
  const projects = [...buckets.project];
  const technical = [...buckets.technical];
  while (projects.length || technical.length) {
    if (projects.length) ordered.push(projects.shift());
    if (technical.length) ordered.push(technical.shift());
  }
  ordered.push(...buckets.behavioral);

  return ordered.map((item, index) => ({ index, ...item }));
}
