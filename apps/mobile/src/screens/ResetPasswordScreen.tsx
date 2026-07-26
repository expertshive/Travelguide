import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Input, Spinner } from '@ui-kitten/components';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import * as authApi from '../lib/auth';
import type { AuthStackParamList } from '../navigation/types';
import { AuthLayout } from '../ui/AuthLayout';
import { Banner } from '../ui/Banner';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

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

      <Input
        style={styles.field}
        label="Reset token"
        placeholder="Paste the token from your email"
        autoCapitalize="none"
        value={token}
        onChangeText={setToken}
      />
      <Input
        style={styles.field}
        label="New password"
        placeholder="Min. 8 characters"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Input
        style={styles.field}
        label="Confirm password"
        placeholder="Repeat your new password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />

      <Button
        style={styles.submit}
        size="large"
        disabled={submitting}
        accessoryLeft={submitting ? () => <Spinner size="small" status="control" /> : undefined}
        onPress={() => void onSubmit()}
      >
        {submitting ? 'Updating…' : 'Update password'}
      </Button>

      <Button appearance="ghost" size="small" onPress={() => navigation.navigate('Login')}>
        Back to sign in
      </Button>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
  },
  submit: {
    borderRadius: 14,
  },
});
