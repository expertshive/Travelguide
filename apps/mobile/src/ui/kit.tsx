import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Gradient } from './Gradient';
import { colors, font, radius, shadow, spacing } from './tokens';

/* -------------------------------------------------------------------------- */
/* Screen scaffold                                                             */
/* -------------------------------------------------------------------------- */

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  bg = colors.bg,
  style,
}: {
  children: ReactNode;
  edges?: Edge[];
  bg?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <SafeAreaView style={[styles.screen, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Text                                                                        */
/* -------------------------------------------------------------------------- */

type Variant = keyof typeof font;

export function Txt({
  variant = 'body',
  color = colors.text,
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; center?: boolean }) {
  return (
    <Text
      {...rest}
      style={[font[variant], { color }, center && styles.center, style]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  style,
  padded = true,
  elevation = 'card',
  children,
  ...rest
}: ViewProps & { padded?: boolean; elevation?: 'card' | 'soft' | 'none' }) {
  return (
    <View
      {...rest}
      style={[
        styles.card,
        padded && styles.cardPad,
        elevation !== 'none' && shadow[elevation],
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  loading?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading,
  left,
  right,
  full = true,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const height = size === 'lg' ? 54 : 46;
  const label = (color: string) => (
    <View style={styles.btnInner}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {left}
          <Txt variant="bodyStrong" color={color}>
            {title}
          </Txt>
          {right}
        </>
      )}
    </View>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        {...rest}
        disabled={isDisabled}
        style={({ pressed }) => [
          full && styles.full,
          { borderRadius: radius.md },
          shadow.soft,
          (pressed || isDisabled) && styles.pressed,
          style,
        ]}
      >
        <Gradient
          name="brandBright"
          angle="horizontal"
          style={[styles.btn, { height, borderRadius: radius.md }]}
        >
          {label(colors.onPrimary)}
        </Gradient>
      </Pressable>
    );
  }

  const palette: Record<string, { bg: string; fg: string; border?: string }> = {
    secondary: { bg: colors.primarySoft, fg: colors.primarySoftText },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const p = palette[variant];

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        full && styles.full,
        {
          height,
          borderRadius: radius.md,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
        },
        (pressed || isDisabled) && styles.pressed,
        style,
      ]}
    >
      {label(p.fg)}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Icon button                                                                 */
/* -------------------------------------------------------------------------- */

export function IconButton({
  children,
  tint = colors.text,
  bg = colors.surfaceAlt,
  size = 40,
  style,
  ...rest
}: Omit<PressableProps, 'style'> & {
  children: ReactNode;
  tint?: string;
  bg?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size, borderRadius: size / 3, backgroundColor: bg },
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

type FieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  left?: ReactNode;
  right?: ReactNode;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, hint, error, left, right, style, ...rest },
  ref,
) {
  return (
    <View style={styles.field}>
      {label ? (
        <Txt variant="small" color={colors.textDim} style={styles.fieldLabel}>
          {label}
        </Txt>
      ) : null}
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        {left ? <View style={styles.inputIcon}>{left}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textFaint}
          style={[styles.input, left ? styles.inputWithLeft : null, style]}
          {...rest}
        />
        {right ? <View style={styles.inputIcon}>{right}</View> : null}
      </View>
      {error ? (
        <Txt variant="small" color={colors.danger} style={styles.fieldHint}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small" color={colors.textFaint} style={styles.fieldHint}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

export function Avatar({
  uri,
  name,
  size = 48,
  ring,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const initial = (name ?? '?').charAt(0).toUpperCase();
  const inner = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <Gradient
      name="brand"
      style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Txt variant="h3" color={colors.onPrimary} style={{ fontSize: size * 0.4 }}>
        {initial}
      </Txt>
    </Gradient>
  );
  if (!ring) return inner;
  return (
    <View style={[styles.avatarRing, { borderRadius: (size + 8) / 2, padding: 3 }]}>{inner}</View>
  );
}

/* -------------------------------------------------------------------------- */
/* Chip / Pill / Badge                                                         */
/* -------------------------------------------------------------------------- */

export function Chip({
  label,
  active,
  left,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  left?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipIdle,
        pressed && styles.pressed,
        style,
      ]}
    >
      {left}
      <Txt variant="small" color={active ? colors.onPrimary : colors.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'danger' | 'accent';
}) {
  const map = {
    neutral: { bg: colors.primarySoft, fg: colors.primarySoftText },
    success: { bg: colors.successSoft, fg: colors.success },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    accent: { bg: colors.accentSoft, fg: colors.accent },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Txt variant="caption" color={map.fg}>
        {label}
      </Txt>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Txt variant="title" center>
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="body" color={colors.textDim} center style={styles.emptySub}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.primary} />
      {label ? (
        <Txt variant="small" color={colors.textDim} style={{ marginTop: spacing.sm }}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { textAlign: 'center' },
  full: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  cardPad: { padding: spacing.lg },

  btn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  iconBtn: { alignItems: 'center', justifyContent: 'center' },

  field: { marginBottom: spacing.lg },
  fieldLabel: { marginBottom: 6, marginLeft: 2 },
  fieldHint: { marginTop: 6, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  inputIcon: { alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  inputWithLeft: { paddingLeft: spacing.sm },

  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderWidth: 2, borderColor: colors.primarySoft, alignSelf: 'flex-start' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  chipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },

  divider: { height: 1, backgroundColor: colors.border },

  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptySub: { marginTop: 6 },

  loader: { paddingVertical: spacing.xxxl, alignItems: 'center', justifyContent: 'center' },
});
