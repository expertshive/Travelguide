import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema } from '@traveler-guide/validation';
import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../auth/AuthShell';
import { Alert, Button, TextField } from '../ui';

export default function ResetPasswordPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      const result = await auth.resetPassword(parsed.data);
      setMessage(result.message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Choose a new password for your account."
      footer={
        <Link to="/login" className="font-medium text-brand-500 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="grid gap-5" onSubmit={onSubmit}>
        {!token ? (
          <Alert tone="error">Missing reset token. Use the link from your email.</Alert>
        ) : null}

        <TextField
          label="New password"
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <TextField
          label="Confirm password"
          type="password"
          placeholder="Repeat your new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <Button type="submit" disabled={submitting || !token} className="w-full py-3.5">
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}
