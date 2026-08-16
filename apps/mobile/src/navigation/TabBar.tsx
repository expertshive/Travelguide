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

/** Floating capsule tab bar. The active tab is a nested pill, not a rectangle. */
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
            <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={8}>
              <View style={focused ? styles.pill : styles.idle}>
                <Glyph color={focused ? colors.onPrimary : colors.textFaint} size={focused ? 18 : 22} />
                {focused ? (
                  <Txt variant="small" color={colors.onPrimary} style={styles.pillLabel}>
                    {label}
                  </Txt>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const PILL_H = 44;

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
    height: 56,
    padding: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.lifted,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    width: PILL_H,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: PILL_H,
    paddingHorizontal: 16,
    borderRadius: PILL_H / 2,
    backgroundColor: colors.primary,
    gap: 6,
  },
  pillLabel: { fontWeight: '700' },
});
