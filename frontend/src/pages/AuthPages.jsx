import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { login, signup } from "../api/auth.js";
import { Logo } from "../components/layout/AppShell.jsx";
import { Alert, Button, Card, Field } from "../components/ui/primitives.jsx";
import { errorMessage, fieldErrors } from "../utils/errorMessages.js";

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <Link to="/" className="mb-8">
        <Logo />
      </Link>
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </Card>
      <p className="mt-6 text-sm text-slate-600">{footer}</p>
    </div>
  );
}

function useAuthForm(action, initial) {
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const bind = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event) => setValues((v) => ({ ...v, [name]: event.target.value })),
  });

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      await action(values);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return { bind, onSubmit, formError, submitting };
}

export function Login() {
  const { bind, onSubmit, formError, submitting } = useAuthForm(login, { email: "", password: "" });
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue practising."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field label="Email" type="email" autoComplete="email" required {...bind("email")} />
        <Field label="Password" type="password" autoComplete="current-password" required {...bind("password")} />
        <Button type="submit" className="w-full" loading={submitting}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function Signup() {
  const { bind, onSubmit, formError, submitting } = useAuthForm(signup, { name: "", email: "", password: "" });
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free forever. Your interviews and reports stay private to you."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field label="Name" autoComplete="name" required {...bind("name")} />
        <Field label="Email" type="email" autoComplete="email" required {...bind("email")} />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a digit."
          required
          {...bind("password")}
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
