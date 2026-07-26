import { Text, useTheme } from '@ui-kitten/components';
import { StyleSheet, View } from 'react-native';

export function Banner({ tone, message }: { tone: 'danger' | 'success'; message: string }) {
  const theme = useTheme();
  const color = theme[tone === 'danger' ? 'color-danger-500' : 'color-success-500'];

  return (
    <View style={[styles.banner, { backgroundColor: `${color}1A` }]}>
      <Text style={{ color }} category="p2">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
});
