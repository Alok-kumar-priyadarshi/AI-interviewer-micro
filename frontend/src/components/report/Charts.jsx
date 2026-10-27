import { scoreTone } from "../../utils/format.js";

/** Circular 0-100 score. */
export function ScoreRing({ score, size = 120 }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={score == null ? "No score" : `Overall score ${score} out of 100`}>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value / 100)}
        transform="rotate(-90 60 60)"
        className={scoreTone(score, 100)}
      />
      <text x="60" y="58" textAnchor="middle" className="fill-slate-900 text-[26px] font-bold">
        {score == null ? "–" : Math.round(score)}
      </text>
      <text x="60" y="78" textAnchor="middle" className="fill-slate-500 text-[11px]">
        out of 100
      </text>
    </svg>
  );
}

/** Horizontal 0-10 bar with its value. */
export function ScoreBar({ label, score, delta }) {
  const width = score == null ? 0 : (score / 10) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className={`font-semibold ${scoreTone(score)}`}>
          {score == null ? "n/a" : `${score}/10`}
          {delta != null && (
            <span className={`ml-2 text-xs font-medium ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** Small line chart of overall scores over time (0-100). The last point is highlighted. */
export function TrendLine({ points, height = 150 }) {
  const values = points.map((p) => p.overall);
  if (points.length < 2 || values.every((v) => v == null)) return null;
  const width = 480;
  const pad = 32;
  const x = (i) => pad + (i * (width - pad * 2)) / (points.length - 1);
  const y = (v) => height - pad - ((v ?? 0) / 100) * (height - pad * 2);
  const path = points
    .map((p, i) => (p.overall == null ? null : `${x(i)},${y(p.overall)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Overall score trend: ${values.map((v) => v ?? "no score").join(", ")}`}>
      {[0, 50, 100].map((tick) => (
        <g key={tick}>
          <line x1={pad} x2={width - pad} y1={y(tick)} y2={y(tick)} stroke="currentColor" className="text-slate-100" />
          <text x={2} y={y(tick) + 5} className="fill-slate-400 text-[14px]">
            {tick}
          </text>
        </g>
      ))}
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-500" />
      {points.map((p, i) =>
        p.overall == null ? null : (
          <circle
            key={p.sessionId ?? i}
            cx={x(i)}
            cy={y(p.overall)}
            r={i === points.length - 1 ? 5 : 3.5}
            className={i === points.length - 1 ? "fill-indigo-600" : "fill-white stroke-indigo-500"}
            strokeWidth="2"
          />
        ),
      )}
    </svg>
  );
}
