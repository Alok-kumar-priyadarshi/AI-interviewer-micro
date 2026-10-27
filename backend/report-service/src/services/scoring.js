export const CATEGORIES = ["intro", "project", "technical", "behavioral"];
const FOLLOW_UP_WEIGHT = 0.5;

export const round1 = (value) => (value == null || Number.isNaN(value) ? null : Math.round(value * 10) / 10);
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

function weightedMean(turns, pick) {
  let sum = 0;
  let weight = 0;
  for (const turn of turns) {
    const value = pick(turn);
    if (value == null) continue;
    const w = turn.isFollowUp ? FOLLOW_UP_WEIGHT : 1;
    sum += value * w;
    weight += w;
  }
  return weight ? sum / weight : null;
}

/**
 * All report numbers, computed in code from the stored turn scores (never by the model).
 * Main questions weigh 1, follow-ups 0.5. Overall is 0-100; categories are 0-10.
 */
export function computeNumbers(turns) {
  const answered = turns.filter((t) => t.answeredAt && t.answerText);
  const scored = answered.filter((t) => typeof t.score === "number");
  const overall = weightedMean(scored, (t) => t.score);

  const categoryScores = Object.fromEntries(
    CATEGORIES.map((c) => [c, round1(weightedMean(scored.filter((t) => t.category === c), (t) => t.score))]),
  );
  categoryScores.communication = round1(weightedMean(scored, (t) => t.rubric?.communication ?? null));

  return {
    questionsAnswered: answered.length,
    overallScore: overall == null ? null : round1(overall * 10),
    categoryScores,
  };
}

const topicKey = (topic) => String(topic ?? "").trim().toLowerCase();

/**
 * Progress against the user's earlier reports (newest first): averages, deltas, a trend line of
 * up to 10 points ending with this interview, and weak topics that keep coming back.
 */
export function computeComparison(previous, current) {
  const previousScores = previous.map((p) => p.overallScore).filter((v) => v != null);
  const previousAverage = previousScores.length ? round1(mean(previousScores)) : null;
  const delta =
    previousAverage != null && current.overallScore != null ? round1(current.overallScore - previousAverage) : null;

  const categoryDeltas = {};
  for (const category of [...CATEGORIES, "communication"]) {
    const past = previous.map((p) => p.categoryScores?.[category]).filter((v) => v != null);
    const now = current.categoryScores[category];
    if (past.length && now != null) categoryDeltas[category] = round1(now - mean(past));
  }

  const trend = [
    ...previous
      .slice(0, 9)
      .reverse()
      .map((p) => ({
        sessionId: p.sessionId,
        date: new Date(p.createdAt).toISOString().slice(0, 10),
        level: p.level,
        overall: p.overallScore,
      })),
    { sessionId: current.sessionId, date: current.date, level: current.level, overall: current.overallScore },
  ];

  const counts = new Map();
  for (const list of [current.improvements, ...previous.map((p) => p.improvements)]) {
    const seen = new Set();
    for (const item of list ?? []) {
      const key = topicKey(item.topic);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key) ?? { label: item.topic.trim(), count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  const recurringWeakTopics = [...counts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((entry) => entry.label);

  return { previousCount: previous.length, previousAverage, delta, categoryDeltas, trend, recurringWeakTopics };
}
