import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema } from '@traveler-guide/validation';
import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../auth/AuthShell';
import { Alert, Button, TextField } from '../ui';

export default function ForgotPasswordPage() {
  const { auth } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setResetUrl(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email');
      return;
    }

    setSubmitting(true);
    try {
      const result = await auth.forgotPassword(parsed.data);
      setMessage(result.message);
      if (result.resetUrl) setResetUrl(result.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Forgot Password"
      subtitle="Enter your email and we will send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-brand-500 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="grid gap-5" onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          placeholder="you@travelerguide.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        {resetUrl ? (
          <p className="text-sm text-gray-700">
            Dev reset link:{' '}
            <a href={resetUrl} className="font-medium text-brand-500 hover:underline">
              Open reset page
            </a>
          </p>
        ) : null}

        <Button type="submit" disabled={submitting} className="w-full py-3.5">
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthShell>
  );
}
