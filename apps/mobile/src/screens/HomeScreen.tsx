import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  listRecentSearches,
  listSavedPlaces,
  type RecentSearch,
  type SavedPlace,
} from '../lib/map';
import { getMyProfile, resolveMediaUrl } from '../lib/profile';
import type { TabScreenProps } from '../navigation/types';
import {
  Avatar,
  Card,
  Gradient,
  Icon,
  IconButton,
  Txt,
  colors,
  radius,
  shadow,
  spacing,
} from '../ui';

type Props = TabScreenProps<'Home'>;
type IconType = (p: { color?: string; size?: number }) => React.ReactElement;

const CATEGORIES = [
  { label: 'Restaurants', query: 'restaurant', grad: 'sunset' as const, icon: Icon.FoodIcon },
  { label: 'Hotels', query: 'hotel', grad: 'ocean' as const, icon: Icon.HotelIcon },
  { label: 'Coffee', query: 'cafe', grad: 'brand' as const, icon: Icon.CafeIcon },
  { label: 'Fuel', query: 'gas station', grad: 'night' as const, icon: Icon.FuelIcon },
];

const PLACE_ICON: Record<string, IconType> = {
  HOME: Icon.HomeIcon,
  WORK: Icon.WorkIcon,
  CUSTOM: Icon.MapPinIcon,
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function openOnMap(
  navigation: Props['navigation'],
  item: { id?: string; name: string; address: string; latitude: number; longitude: number },
) {
  navigation.navigate('Map', {
    destination: {
      id: item.id,
      name: item.name,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
    },
  });
}

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  function openExplore(category: string) {
    navigation.navigate('Map', { explore: category.trim() });
  }

  function openSearch(text: string) {
    const q = text.trim();
    navigation.navigate('Map', q ? { query: q } : {});
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        listSavedPlaces().catch(() => [] as SavedPlace[]),
        listRecentSearches().catch(() => [] as RecentSearch[]),
      ]).then(([s, r]) => {
        if (!active) return;
        setSaved(s);
        setRecent(r);
      });
      getMyProfile()
        .then((p) => active && setAvatarUrl(resolveMediaUrl(p.avatarUrl)))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  const firstName = (user?.name ?? '').split(' ')[0] || 'Traveler';

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Gradient name="brand" style={styles.header}>
          {/* Decorative blobs for depth */}
          <View style={styles.blobOne} pointerEvents="none" />
          <View style={styles.blobTwo} pointerEvents="none" />

          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Txt variant="small" color="rgba(255,255,255,0.8)">
                {greeting()},
              </Txt>
              <Txt variant="h2" color={colors.onPrimary} style={{ marginTop: 2 }}>
                {firstName}
              </Txt>
              <Txt variant="small" color="rgba(255,255,255,0.78)" style={{ marginTop: 4 }}>
                Let’s plan a stop along the way
              </Txt>
            </View>
            <IconButton bg="rgba(255,255,255,0.16)" onPress={() => {}}>
              <Icon.BellIcon color={colors.onPrimary} size={20} />
            </IconButton>
            <Pressable
              onPress={() => navigation.navigate('Profile')}
              style={{ marginLeft: spacing.sm }}
            >
              <Avatar uri={avatarUrl} name={user?.name ?? user?.email} size={44} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Icon.SearchIcon color={colors.textFaint} size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Where do you want to go?"
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => openSearch(search)}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.searchGo}
              onPress={() => openSearch(search)}
              hitSlop={6}
            >
              <Icon.NavigationIcon color={colors.onPrimary} size={18} />
            </Pressable>
          </View>
        </Gradient>

        <Pressable
          style={({ pressed }) => [styles.featuredWrap, pressed && styles.pressed]}
          onPress={() => openExplore('tourist attraction')}
        >
          <Gradient name="candy" style={styles.featured}>
            <View style={styles.featBlob} pointerEvents="none" />
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color="rgba(255,255,255,0.85)">
                FEATURED
              </Txt>
              <Txt variant="h3" color={colors.onPrimary} style={{ marginTop: 4 }}>
                Discover top attractions
              </Txt>
              <Txt variant="small" color="rgba(255,255,255,0.9)" style={{ marginTop: 2 }}>
                Famous places near you — tap to open on the map
              </Txt>
              <View style={styles.featCta}>
                <Txt variant="caption" color={colors.onPrimary}>
                  EXPLORE
                </Txt>
                <Icon.ChevronRightIcon color={colors.onPrimary} size={14} />
              </View>
            </View>
            <View style={styles.featIcon}>
              <Icon.CompassIcon color={colors.onPrimary} size={30} />
            </View>
          </Gradient>
        </Pressable>

        <View style={styles.section}>
          <Txt variant="h3" style={styles.sectionTitle}>
            Explore nearby
          </Txt>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => {
              const CatIcon = c.icon;
              return (
                <Pressable
                  key={c.label}
                  style={({ pressed }) => [styles.catItem, pressed && styles.pressed]}
                  onPress={() => openExplore(c.query)}
                >
                  <Gradient name={c.grad} style={styles.catIcon}>
                    <CatIcon color={colors.onPrimary} size={24} />
                  </Gradient>
                  <Txt variant="small" center numberOfLines={1} style={styles.catLabel}>
                    {c.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Txt variant="h3">Saved places</Txt>
            <Pressable onPress={() => navigation.navigate('Saved')}>
              <Txt variant="small" color={colors.primary}>
                See all
              </Txt>
            </Pressable>
          </View>

          {saved.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedRow}
            >
              {saved.map((place) => {
                const PIcon = PLACE_ICON[place.label] ?? Icon.MapPinIcon;
                return (
                  <Pressable
                    key={place.id}
                    style={styles.savedCard}
                    onPress={() =>
                      openOnMap(navigation, {
                        id: place.id,
                        name: place.name,
                        address: place.address,
                        latitude: place.latitude,
                        longitude: place.longitude,
                      })
                    }
                  >
                    <View style={styles.savedIcon}>
                      <PIcon color={colors.primary} size={20} />
                    </View>
                    <Txt variant="bodyStrong" numberOfLines={1} style={{ marginTop: spacing.sm }}>
                      {place.label === 'CUSTOM'
                        ? place.name
                        : place.label === 'HOME'
                          ? 'Home'
                          : 'Work'}
                    </Txt>
                    <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                      {place.address}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Card style={styles.emptyCard} elevation="soft">
              <View style={styles.savedIcon}>
                <Icon.BookmarkIcon color={colors.primary} size={20} />
              </View>
              <Txt variant="bodyStrong" style={{ marginTop: spacing.sm }}>
                No saved places yet
              </Txt>
              <Txt variant="small" color={colors.textDim} style={{ marginTop: 2 }}>
                Search a place and save it as Home, Work, or a favourite.
              </Txt>
              <Pressable style={styles.emptyCta} onPress={() => navigation.navigate('Map', {})}>
                <Icon.PlusIcon color={colors.primary} size={18} />
                <Txt variant="small" color={colors.primary}>
                  Add a place
                </Txt>
              </Pressable>
            </Card>
          )}
        </View>

        {recent.length ? (
          <View style={styles.section}>
            <Txt variant="h3" style={styles.sectionTitle}>
              Recent
            </Txt>
            <Card padded={false} elevation="soft">
              {recent.slice(0, 6).map((r, i) => (
                <Pressable
                  key={r.id}
                  style={[styles.recentRow, i > 0 && styles.recentBorderTop]}
                  onPress={() =>
                    openOnMap(navigation, {
                      name: r.name,
                      address: r.address,
                      latitude: r.latitude,
                      longitude: r.longitude,
                    })
                  }
                >
                  <View style={styles.recentIcon}>
                    <Icon.ClockIcon color={colors.textDim} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {r.name}
                    </Txt>
                    <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                      {r.address}
                    </Txt>
                  </View>
                  <Icon.ChevronRightIcon color={colors.textFaint} size={18} />
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={[styles.section, { marginTop: spacing.lg }]}>
          <Card elevation="soft" style={styles.tipRow}>
            <View style={styles.tipIcon}>
              <Icon.NavigationIcon color={colors.teal} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Start, stops, and destination live on the map</Txt>
              <Txt variant="small" color={colors.textDim}>
                Open Map, allow location, then add stops before you start the trip.
              </Txt>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 120 },

  header: {
    paddingTop: spacing.xxxl + spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl + 6,
    borderBottomRightRadius: radius.xl + 6,
    overflow: 'hidden',
  },
  blobOne: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  blobTwo: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  searchBar: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  searchGo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },

  featuredWrap: { marginHorizontal: spacing.xl, marginTop: spacing.xl },
  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.lifted,
  },
  featBlob: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  featCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  featIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl },
  sectionTitle: { marginBottom: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  catGrid: { flexDirection: 'row', gap: spacing.md },
  catItem: { flex: 1, alignItems: 'center' },
  catIcon: {
    width: '100%',
    maxWidth: 70,
    aspectRatio: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  catLabel: { marginTop: 8, width: '100%' },

  savedRow: { gap: spacing.md, paddingRight: spacing.xl },
  savedCard: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  savedIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyCard: { alignItems: 'flex-start' },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
  },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recentBorderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
