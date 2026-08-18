import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt, colors, radius, shadow, spacing } from '../ui';
import { BookmarkIcon, HomeIcon, MapPinIcon, PersonIcon } from '../ui/icons';
import { useTabBarHidden } from '../lib/tabBarVisibility';

type IconProps = { color?: string; size?: number };
const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  Home: HomeIcon,
  Map: MapPinIcon,
  Saved: BookmarkIcon,
  Profile: PersonIcon,
};

/** Floating tab bar: icon + label, soft selected tint — no solid box. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const hidden = useTabBarHidden();

  if (hidden) return null;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? route.name;
          const Glyph = ICONS[route.name] ?? HomeIcon;
          const tint = focused ? colors.primary : colors.textFaint;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={4}
              android_ripple={{ color: colors.primarySoft, borderless: true, radius: 32 }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapOn]}>
                <Glyph color={tint} size={22} />
              </View>
              <Txt variant="caption" color={tint} style={styles.label}>
                {label}
              </Txt>
              <View style={[styles.dot, focused ? styles.dotOn : styles.dotOff]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pressed: { opacity: 0.72 },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconWrapOn: { backgroundColor: colors.primarySoft },
  label: { fontWeight: '700', letterSpacing: 0.2 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  dotOn: { backgroundColor: colors.primary },
  dotOff: { backgroundColor: 'transparent' },
});
