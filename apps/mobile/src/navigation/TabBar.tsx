import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gradient, Txt, colors, radius, shadow, spacing } from '../ui';
import { BookmarkIcon, HomeIcon, MapPinIcon, PersonIcon } from '../ui/icons';

type IconProps = { color?: string; size?: number };
const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  Home: HomeIcon,
  Map: MapPinIcon,
  Saved: BookmarkIcon,
  Profile: PersonIcon,
};

/** A floating, rounded tab bar with a gradient pill on the active tab. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? route.name;
          const Icon = ICONS[route.name] ?? HomeIcon;

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

          if (focused) {
            return (
              <Pressable key={route.key} onPress={onPress} style={styles.item}>
                <Gradient name="brandBright" angle="horizontal" style={styles.pill}>
                  <Icon color={colors.onPrimary} size={20} />
                  <Txt variant="small" color={colors.onPrimary} style={styles.pillLabel}>
                    {label}
                  </Txt>
                </Gradient>
              </Pressable>
            );
          }

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={8}>
              <Icon color={colors.textFaint} size={22} />
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
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadow.lifted,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    gap: 6,
  },
  pillLabel: { fontWeight: '700' },
});
