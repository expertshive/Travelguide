import { useState } from 'react';
import * as authApi from '../lib/auth';
import type { AuthScreenProps } from '../navigation/types';
import { Button, Field, spacing } from '../ui';
import { AuthLayout } from '../ui/AuthLayout';
import { Banner } from '../ui/Banner';

type Props = AuthScreenProps<'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const [token, setToken] = useState(route.params?.token ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const result = await authApi.resetPassword(token.trim(), password);
      setMessage(result.message);
      setTimeout(() => navigation.navigate('Login'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="Enter your reset token and a new password.">
      {error ? <Banner tone="danger" message={error} /> : null}
      {message ? <Banner tone="success" message={message} /> : null}

      <Field
        label="Reset token"
        placeholder="Paste the token from your email"
        autoCapitalize="none"
        value={token}
        onChangeText={setToken}
      />
      <Field
        label="New password"
        placeholder="Min. 8 characters"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Field
        label="Confirm password"
        placeholder="Repeat your new password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />

      <Button
        title={submitting ? 'Updating…' : 'Update password'}
        loading={submitting}
        onPress={() => void onSubmit()}
      />
      <Button
        title="Back to sign in"
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={() => navigation.navigate('Login')}
      />
    </AuthLayout>
  );
}
