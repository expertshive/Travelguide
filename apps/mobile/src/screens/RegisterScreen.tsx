import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { AuthScreenProps } from '../navigation/types';
import { Button, Field, Icon, Txt, colors, spacing } from '../ui';
import { AuthLayout } from '../ui/AuthLayout';
import { Banner } from '../ui/Banner';

type Props = AuthScreenProps<'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { sendRegisterOtp, verifyRegisterOtp } = useAuth();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSendOtp() {
    setError(null);
    if (!name.trim() || !email.trim() || !mobile.trim()) {
      setError('Name, email, and mobile are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await sendRegisterOtp({
        email: email.trim(),
        name: name.trim(),
        mobile: mobile.trim(),
        password,
        confirmPassword,
      });
      setOtpHint(result.otpHint ?? '0000');
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerifyOtp() {
    setError(null);
    if (!otp.trim()) {
      setError('Enter the OTP code.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyRegisterOtp(email.trim(), otp.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle={
        step === 'form'
          ? 'Enter your details and we will send you a verification code.'
          : 'Enter the code we sent to finish signing up.'
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}

      {step === 'form' ? (
        <>
          <Field label="Full name" placeholder="Jane Traveler" autoComplete="name" value={name} onChangeText={setName} />
          <Field
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Mobile"
            placeholder="+966501234567"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={mobile}
            onChangeText={setMobile}
          />
          <Field
            label="Password"
            placeholder="Min. 8 characters"
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            right={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <Icon.EyeOffIcon color={colors.textDim} size={20} />
                ) : (
                  <Icon.EyeIcon color={colors.textDim} size={20} />
                )}
              </Pressable>
            }
          />
          <Field
            label="Confirm password"
            placeholder="Repeat your password"
            secureTextEntry={!showConfirmPassword}
            autoComplete="new-password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            right={
              <Pressable
                onPress={() => setShowConfirmPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <Icon.EyeOffIcon color={colors.textDim} size={20} />
                ) : (
                  <Icon.EyeIcon color={colors.textDim} size={20} />
                )}
              </Pressable>
            }
          />

          <Button
            title={submitting ? 'Sending…' : 'Send code'}
            loading={submitting}
            onPress={() => void onSendOtp()}
          />
        </>
      ) : (
        <>
          <View style={styles.hint}>
            <Txt variant="small" color={colors.textDim}>
              Code sent to {email}
              {otpHint ? ` · dev code ${otpHint}` : ''}
            </Txt>
          </View>

          <Field
            label="Verification code"
            placeholder="0000"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />

          <Button
            title={submitting ? 'Verifying…' : 'Verify & create account'}
            loading={submitting}
            onPress={() => void onVerifyOtp()}
          />
          <Button
            title="Back to details"
            variant="ghost"
            onPress={() => setStep('form')}
            style={{ marginTop: spacing.sm }}
          />
        </>
      )}

      <View style={styles.footer}>
        <Txt variant="small" color={colors.textDim}>
          Already registered?{' '}
        </Txt>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Txt variant="small" color={colors.primary}>
            Sign in
          </Txt>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  hint: { marginBottom: spacing.lg },
  footer: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
