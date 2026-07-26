import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, CheckBox, Input, Spinner, Text } from '@ui-kitten/components';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  clearSavedCredentials,
  getSavedCredentials,
  saveCredentials,
} from '../lib/credentials';
import type { AuthStackParamList } from '../navigation/types';
import { AuthLayout } from '../ui/AuthLayout';
import { Banner } from '../ui/Banner';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

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
    <AuthLayout title="Sign in" subtitle="Welcome back. Let's get you travelling.">
      {error ? <Banner tone="danger" message={error} /> : null}

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
        label="Password"
        placeholder="Min. 8 characters"
        secureTextEntry={secure}
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.row}>
        <CheckBox checked={remember} onChange={setRemember}>
          Remember me
        </CheckBox>
        <Button appearance="ghost" size="tiny" onPress={() => setSecure((prev) => !prev)}>
          {secure ? 'Show password' : 'Hide password'}
        </Button>
      </View>

      <Button
        style={styles.submit}
        size="large"
        disabled={submitting}
        accessoryLeft={submitting ? () => <Spinner size="small" status="control" /> : undefined}
        onPress={() => void onSubmit()}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <Button
        appearance="ghost"
        size="small"
        onPress={() => navigation.navigate('ForgotPassword')}
      >
        Forgot password?
      </Button>

      <View style={styles.footer}>
        <Text appearance="hint" category="p2">
          New here?
        </Text>
        <Button appearance="ghost" size="small" onPress={() => navigation.navigate('Register')}>
          Create an account
        </Button>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  submit: {
    borderRadius: 14,
  },
  footer: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
