import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Input, Spinner, Text } from '@ui-kitten/components';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { AuthStackParamList } from '../navigation/types';
import { AuthLayout } from '../ui/AuthLayout';
import { Banner } from '../ui/Banner';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { sendRegisterOtp, verifyRegisterOtp } = useAuth();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const spinner = submitting ? () => <Spinner size="small" status="control" /> : undefined;

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
          <Input
            style={styles.field}
            label="Full name"
            placeholder="Jane Traveler"
            autoComplete="name"
            value={name}
            onChangeText={setName}
          />
          <Input
            style={styles.field}
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            style={styles.field}
            label="Mobile"
            placeholder="+966501234567"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={mobile}
            onChangeText={setMobile}
          />
          <Input
            style={styles.field}
            label="Password"
            placeholder="Min. 8 characters"
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />
          <Input
            style={styles.field}
            label="Confirm password"
            placeholder="Repeat your password"
            secureTextEntry
            autoComplete="new-password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Button
            style={styles.submit}
            size="large"
            disabled={submitting}
            accessoryLeft={spinner}
            onPress={() => void onSendOtp()}
          >
            {submitting ? 'Sending…' : 'Send code'}
          </Button>
        </>
      ) : (
        <>
          <Text appearance="hint" category="p2" style={styles.hint}>
            Code sent to {email}
            {otpHint ? ` · dev code ${otpHint}` : ''}
          </Text>

          <Input
            style={styles.field}
            label="Verification code"
            placeholder="0000"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />

          <Button
            style={styles.submit}
            size="large"
            disabled={submitting}
            accessoryLeft={spinner}
            onPress={() => void onVerifyOtp()}
          >
            {submitting ? 'Verifying…' : 'Verify & create account'}
          </Button>

          <Button appearance="ghost" size="small" onPress={() => setStep('form')}>
            Back to details
          </Button>
        </>
      )}

      <View style={styles.footer}>
        <Text appearance="hint" category="p2">
          Already registered?
        </Text>
        <Button appearance="ghost" size="small" onPress={() => navigation.navigate('Login')}>
          Sign in
        </Button>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
  },
  hint: {
    marginBottom: 14,
  },
  submit: {
    borderRadius: 14,
  },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
