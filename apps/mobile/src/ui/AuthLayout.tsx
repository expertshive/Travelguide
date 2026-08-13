import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gradient } from './Gradient';
import { NavigationIcon } from './icons';
import { Txt } from './kit';
import { colors, radius, shadow, spacing } from './tokens';

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
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Gradient name="brand" style={styles.hero}>
            <SafeAreaView edges={['top']}>
              <View style={styles.brandRow}>
                <View style={styles.logo}>
                  <NavigationIcon color={colors.onPrimary} size={22} />
                </View>
                <Txt variant="caption" color="rgba(255,255,255,0.85)" style={styles.brandText}>
                  TRAVELER GUIDE
                </Txt>
              </View>
              <Txt variant="h1" color={colors.onPrimary} style={styles.title}>
                {title}
              </Txt>
              <Txt variant="body" color="rgba(255,255,255,0.85)" style={styles.subtitle}>
                {subtitle}
              </Txt>
            </SafeAreaView>
          </Gradient>

          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.xxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  logo: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { letterSpacing: 2 },
  title: { marginTop: spacing.xl },
  subtitle: { marginTop: 6, maxWidth: '90%' },

  // The card lifts up into the hero for a layered look. Because both the hero
  // and the card live inside the ScrollView, the overlap is not clipped.
  card: {
    marginTop: -spacing.xxl,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.card,
  },
});
