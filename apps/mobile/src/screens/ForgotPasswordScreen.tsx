import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Input, Spinner, Text } from '@ui-kitten/components';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import * as authApi from '../lib/auth';
import type { AuthStackParamList } from '../navigation/types';
import { AuthLayout } from '../ui/AuthLayout';
import { Banner } from '../ui/Banner';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    setResetToken(null);
    setSubmitting(true);
    try {
      const result = await authApi.forgotPassword(email.trim());
      setMessage(result.message);
      if (result.resetToken) setResetToken(result.resetToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Forgot password" subtitle="Enter your email to receive a reset token.">
      {error ? <Banner tone="danger" message={error} /> : null}
      {message ? <Banner tone="success" message={message} /> : null}

      <Input
        style={styles.field}
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {resetToken ? (
        <Text appearance="hint" category="c1" style={styles.token} selectable>
          Dev token: {resetToken}
        </Text>
      ) : null}

      <Button
        style={styles.submit}
        size="large"
        disabled={submitting}
        accessoryLeft={submitting ? () => <Spinner size="small" status="control" /> : undefined}
        onPress={() => void onSubmit()}
      >
        {submitting ? 'Sending…' : 'Send reset token'}
      </Button>

      <Button
        appearance="ghost"
        size="small"
        onPress={() => navigation.navigate('ResetPassword', { token: resetToken ?? undefined })}
      >
        I have a token
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
  token: {
    marginBottom: 14,
  },
  submit: {
    borderRadius: 14,
  },
});
