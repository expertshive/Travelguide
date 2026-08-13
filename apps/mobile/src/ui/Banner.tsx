import { StyleSheet, View } from 'react-native';
import { Txt } from './kit';
import { colors, radius, spacing } from './tokens';

export function Banner({ tone, message }: { tone: 'danger' | 'success'; message: string }) {
  const bg = tone === 'danger' ? colors.dangerSoft : colors.successSoft;
  const fg = tone === 'danger' ? colors.danger : colors.success;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Txt variant="small" color={fg}>
        {message}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
});
