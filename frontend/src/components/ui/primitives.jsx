import { useId } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { buttonClasses } from "./buttonClasses.js";

export function Button({ variant, size, loading = false, className, children, disabled, type = "button", ...props }) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} disabled={disabled || loading} {...props}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-5", label }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
      {label && <span className="text-sm text-slate-600">{label}</span>}
    </span>
  );
}

export function FullPageSpinner({ label = "Loading…" }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-6 text-indigo-600" label={label} />
    </div>
  );
}

export function Card({ className = "", padding = "p-5 sm:p-6", children, ...props }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${padding} ${className}`} {...props}>
      {children}
    </div>
  );
}

const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-50 text-indigo-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  rose: "bg-rose-50 text-rose-700",
  sky: "bg-sky-50 text-sky-700",
};

export function Badge({ tone = "slate", className = "", children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const ALERT_STYLES = {
  error: { box: "border-rose-200 bg-rose-50 text-rose-800", Icon: AlertCircle },
  info: { box: "border-sky-200 bg-sky-50 text-sky-800", Icon: Info },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", Icon: AlertCircle },
};

export function Alert({ tone = "error", children, action }) {
  const { box, Icon } = ALERT_STYLES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${box}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

export function Field({ label, error, hint, id, as = "input", className = "", ...props }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  const Control = as;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <Control
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-600 ${error ? "border-rose-400" : "border-slate-300"}`}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 text-sm text-rose-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${fieldId}-hint`} className="mt-1.5 text-sm text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {Icon && <Icon className="mx-auto size-10 text-slate-400" aria-hidden="true" />}
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel = "Confirm", onConfirm, onCancel, loading, tone = "primary" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && onCancel()}
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-600">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
