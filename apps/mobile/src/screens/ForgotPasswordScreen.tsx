import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as authApi from '../lib/auth';
import type { AuthScreenProps } from '../navigation/types';
import { Button, Field, Txt, colors, radius, spacing } from '../ui';
import { AuthLayout } from '../ui/AuthLayout';
import { Banner } from '../ui/Banner';

type Props = AuthScreenProps<'ForgotPassword'>;

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

      <Field
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {resetToken ? (
        <View style={styles.token}>
          <Txt variant="small" color={colors.textDim} selectable>
            Dev token: {resetToken}
          </Txt>
        </View>
      ) : null}

      <Button
        title={submitting ? 'Sending…' : 'Send reset token'}
        loading={submitting}
        onPress={() => void onSubmit()}
      />
      <Button
        title="I have a token"
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={() => navigation.navigate('ResetPassword', { token: resetToken ?? undefined })}
      />
      <Button
        title="Back to sign in"
        variant="ghost"
        style={{ marginTop: spacing.xs }}
        onPress={() => navigation.navigate('Login')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  token: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
});
