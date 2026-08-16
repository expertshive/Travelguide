import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  clearSavedCredentials,
  getSavedCredentials,
  saveCredentials,
} from '../lib/credentials';
import type { AuthScreenProps } from '../navigation/types';
import { Button, Field, Icon, Txt, colors, radius, spacing } from '../ui';
import { AuthLayout } from '../ui/AuthLayout';
import { Banner } from '../ui/Banner';

type Props = AuthScreenProps<'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void getSavedCredentials().then((saved) => {
      if (!active || !saved) return;
      setEmail(saved.email);
      setPassword(saved.password);
      setRemember(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit() {
    setError(null);
    if (!email || password.length < 8) {
      setError('Enter a valid email and password (min 8 characters).');
      return;
    }
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      await login(trimmedEmail, password);
      await (remember
        ? saveCredentials({ email: trimmedEmail, password })
        : clearSavedCredentials());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back — the road is waiting.">
      {error ? <Banner tone="danger" message={error} /> : null}

      <Field
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        left={<Icon.PersonIcon color={colors.textDim} size={18} />}
      />

      <Field
        label="Password"
        placeholder="Min. 8 characters"
        secureTextEntry={secure}
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        left={<Icon.SettingsIcon color={colors.textDim} size={18} />}
        right={
          <Pressable onPress={() => setSecure((p) => !p)} hitSlop={8}>
            <Txt variant="small" color={colors.primary}>
              {secure ? 'Show' : 'Hide'}
            </Txt>
          </Pressable>
        }
      />

      <View style={styles.row}>
        <Pressable style={styles.remember} onPress={() => setRemember((p) => !p)}>
          <View style={[styles.checkbox, remember && styles.checkboxOn]}>
            {remember ? <Icon.CheckIcon color={colors.onPrimary} size={14} /> : null}
          </View>
          <Txt variant="small" color={colors.textDim}>
            Remember me
          </Txt>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8}>
          <Txt variant="small" color={colors.primary}>
            Forgot password?
          </Txt>
        </Pressable>
      </View>

      <Button
        title={submitting ? 'Signing in…' : 'Sign in'}
        loading={submitting}
        onPress={() => void onSubmit()}
        style={{ marginTop: spacing.sm }}
      />

      <View style={styles.footer}>
        <Txt variant="small" color={colors.textDim}>
          New here?{' '}
        </Txt>
        <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
          <Txt variant="small" color={colors.primary}>
            Create an account
          </Txt>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  remember: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
