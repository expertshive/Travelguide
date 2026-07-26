import { Card, Layout, Text } from '@ui-kitten/components';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Layout style={styles.root} level="2">
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text category="label" appearance="hint" style={styles.eyebrow}>
              TRAVELER GUIDE
            </Text>
            <Text category="h1" style={styles.title}>
              {title}
            </Text>
            <Text appearance="hint" style={styles.subtitle}>
              {subtitle}
            </Text>

            <Card style={styles.card} disabled>
              {children}
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    letterSpacing: 2,
  },
  title: {
    marginTop: 8,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 21,
  },
  card: {
    borderRadius: 20,
    borderWidth: 0,
    shadowColor: '#7090B0',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
});
