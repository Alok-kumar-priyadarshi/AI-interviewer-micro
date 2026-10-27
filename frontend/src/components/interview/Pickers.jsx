const LEVELS = [
  { value: "low", title: "Low", text: "Fundamentals, your role and stack. Friendly follow-ups." },
  { value: "medium", title: "Medium", text: "Design choices, trade-offs and debugging scenarios." },
  { value: "high", title: "High", text: "Scale, failure modes, internals and system design." },
];

const COUNTS = [
  { value: 5, title: "5 questions", text: "~10 min" },
  { value: 8, title: "8 questions", text: "~20 min" },
  { value: 12, title: "12 questions", text: "~30 min" },
];

function OptionGroup({ legend, options, value, onChange, name, compact = false }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-900">{legend}</legend>
      <div className={`mt-3 grid gap-3 ${compact ? "grid-cols-3" : "sm:grid-cols-3"}`}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border transition ${compact ? "p-3 text-center sm:p-4" : "p-4"} focus-within:outline-2 focus-within:outline-indigo-600 ${checked ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 bg-white hover:border-indigo-300"}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="block font-semibold text-slate-900">{option.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{option.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function LevelPicker({ value, onChange }) {
  return <OptionGroup legend="Difficulty" name="level" options={LEVELS} value={value} onChange={onChange} />;
}

export function QuestionCountPicker({ value, onChange }) {
  return <OptionGroup legend="Length" name="questionCount" options={COUNTS} value={value} onChange={onChange} compact />;
}
