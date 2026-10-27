export const LEVELS = ["low", "medium", "high"];
export const QUESTION_COUNTS = [5, 8, 12];
export const CATEGORIES = ["intro", "project", "technical", "behavioral"];

/** How many plan items of each category an interview of N questions gets. */
export const CATEGORY_MIX = {
  5: { intro: 1, project: 2, technical: 1, behavioral: 1 },
  8: { intro: 1, project: 3, technical: 3, behavioral: 1 },
  12: { intro: 1, project: 4, technical: 5, behavioral: 2 },
};

/** Maximum follow-up questions per plan item. */
export const FOLLOW_UP_LIMIT = { low: 1, medium: 1, high: 2 };

export const LEVEL_RULES = {
  low: {
    tone: "Encouraging and friendly.",
    intro: "Ask the candidate to introduce themselves and what they enjoy building.",
    project: "Ask what the project does, the candidate's role and the stack used.",
    technical: "Ask about definitions and fundamentals of the skill, with a simple example.",
    behavioral: "Ask about teamwork or learning something new.",
    followUp: "Ask a follow-up only if the answer was empty, very short or off-topic.",
    gradingBar: "A correct basic explanation that is clear earns 7 or more.",
  },
  medium: {
    tone: "Neutral and professional.",
    intro: "Ask the candidate to walk through their path and why they chose their stack.",
    project: "Ask why they made specific design choices, the trade-offs, and what they would change.",
    technical: "Ask applied questions: realistic scenarios, debugging, comparing alternatives.",
    behavioral: "Ask about handling conflict, deadlines or mistakes.",
    followUp: "Ask a follow-up when the answer is vague or misses the reasoning behind it.",
    gradingBar: "7 or more needs a correct answer with reasoning and at least one trade-off.",
  },
  high: {
    tone: "Probing and direct, never rude.",
    intro: "Ask the candidate to pitch themselves for a senior role and justify it.",
    project:
      "Ask how the project would behave at 100 times the load, its failure modes, data consistency and cost.",
    technical: "Ask about internals, edge cases, performance and system design.",
    behavioral: "Ask about leadership, ambiguity or high-stakes decisions.",
    followUp: "Ask a follow-up on any gap, hand-waving, or missing numbers or trade-offs.",
    gradingBar: "7 or more needs a correct, deep answer covering edge cases with concrete examples.",
  },
};

const GENERIC_PROJECT_TOPICS = [
  { topic: "Most challenging project", focus: "the hardest problem and how it was solved" },
  { topic: "A project you are proud of", focus: "design decisions and impact" },
  { topic: "A project that failed or changed direction", focus: "what was learned" },
  { topic: "Collaboration on a project", focus: "how work was split and integrated" },
];

const GENERIC_TECHNICAL_TOPICS = [
  { topic: "Debugging a production issue", focus: "approach, tools and root cause" },
  { topic: "API design", focus: "REST conventions, errors and versioning" },
  { topic: "Databases", focus: "indexing, transactions and data modelling" },
  { topic: "Testing", focus: "what to test and how" },
  { topic: "Performance", focus: "finding and fixing bottlenecks" },
];

const GENERIC_BEHAVIORAL_TOPICS = [
  { topic: "Teamwork and collaboration", focus: "a concrete situation and the outcome" },
  { topic: "Working under a deadline", focus: "prioritisation and communication" },
  { topic: "Learning from a mistake", focus: "what happened and what changed after" },
  { topic: "Disagreement with a teammate", focus: "how it was resolved" },
];

export const FALLBACK_TOPICS = {
  intro: [{ topic: "Background and motivation", focus: "career story and why this field", sourceSection: "summary" }],
  project: GENERIC_PROJECT_TOPICS.map((t) => ({ ...t, sourceSection: "project" })),
  technical: GENERIC_TECHNICAL_TOPICS.map((t) => ({ ...t, sourceSection: "skills" })),
  behavioral: GENERIC_BEHAVIORAL_TOPICS.map((t) => ({ ...t, sourceSection: "experience" })),
};
