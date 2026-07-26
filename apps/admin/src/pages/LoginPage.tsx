import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loginSchema } from '@traveler-guide/validation';
import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../auth/AuthShell';
import { Alert, Button, TextField } from '../ui';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@travelerguide.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Sign In"
      subtitle="Enter your email and password to access the admin portal."
      footer={
        <p>
          Traveler accounts are created in the mobile app. Only staff accounts can sign in here.
        </p>
      }
    >
      <form className="grid gap-5" onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@travelerguide.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-500 hover:underline">
            Forgot password?
          </Link>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <Button type="submit" disabled={submitting} className="w-full py-3.5">
          {submitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </AuthShell>
  );
}
