import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { formatDistance, formatDuration } from '../lib/geo';
import {
  listRecentSearches,
  listSavedPlaces,
  type RecentSearch,
  type SavedPlace,
} from '../lib/map';
import { getMyProfile, resolveMediaUrl } from '../lib/profile';
import { listPastTrips, type SavedTrip } from '../lib/trips';
import type { TabScreenProps } from '../navigation/types';
import {
  Avatar,
  Card,
  Gradient,
  Icon,
  Txt,
  colors,
  radius,
  shadow,
  spacing,
} from '../ui';

type Props = TabScreenProps<'Home'>;
type IconType = (p: { color?: string; size?: number }) => React.ReactElement;

const CATEGORIES = [
  { label: 'Eat', query: 'restaurant', grad: 'sunset' as const, icon: Icon.FoodIcon },
  { label: 'Stay', query: 'hotel', grad: 'ocean' as const, icon: Icon.HotelIcon },
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

function placeTitle(place: SavedPlace) {
  if (place.label === 'HOME') return 'Home';
  if (place.label === 'WORK') return 'Work';
  return place.name;
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [pastTrips, setPastTrips] = useState<SavedTrip[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const pad = width < 360 ? spacing.md : spacing.xl;
  const catSize = Math.min(72, Math.floor((width - pad * 2 - spacing.md * 3) / 4));
  const savedWidth = Math.min(148, Math.max(124, width * 0.38));

  const firstName = useMemo(
    () => (user?.name ?? '').split(' ')[0] || 'Traveler',
    [user?.name],
  );

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
        listPastTrips().catch(() => [] as SavedTrip[]),
      ]).then(([s, r, t]) => {
        if (!active) return;
        setSaved(s);
        setRecent(r);
        setPastTrips(t);
      });
      getMyProfile()
        .then((p) => active && setAvatarUrl(resolveMediaUrl(p.avatarUrl)))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: 96 + insets.bottom }]}
      >
        <Gradient
          name="brand"
          style={[styles.header, { paddingTop: insets.top + spacing.lg, paddingHorizontal: pad }]}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerCopy}>
              <Txt variant="small" color="rgba(255,255,255,0.78)">
                {greeting()}
              </Txt>
              <Txt variant="h2" color={colors.onPrimary} numberOfLines={1}>
                {firstName}
              </Txt>
            </View>
            <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8}>
              <Avatar uri={avatarUrl} name={user?.name ?? user?.email} size={44} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Icon.SearchIcon color={colors.textFaint} size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Where to?"
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => openSearch(search)}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Pressable style={styles.searchGo} onPress={() => openSearch(search)} hitSlop={6}>
              <Icon.NavigationIcon color={colors.onPrimary} size={18} />
            </Pressable>
          </View>
        </Gradient>

        <View style={[styles.section, { paddingHorizontal: pad, marginTop: spacing.xl }]}>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => {
              const CatIcon = c.icon;
              return (
                <Pressable
                  key={c.label}
                  style={({ pressed }) => [
                    styles.catItem,
                    { width: catSize },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => openExplore(c.query)}
                >
                  <Gradient name={c.grad} style={[styles.catIcon, { width: catSize, height: catSize }]}>
                    <CatIcon color={colors.onPrimary} size={Math.round(catSize * 0.36)} />
                  </Gradient>
                  <Txt variant="caption" center numberOfLines={1} style={styles.catLabel}>
                    {c.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        {saved.length ? (
          <View style={[styles.section, { paddingHorizontal: pad }]}>
            <View style={styles.sectionHead}>
              <Txt variant="title">Saved</Txt>
              <Pressable onPress={() => navigation.navigate('Saved')} hitSlop={8}>
                <Txt variant="small" color={colors.primary}>
                  See all
                </Txt>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hRow}
            >
              {saved.slice(0, 8).map((place) => {
                const PIcon = PLACE_ICON[place.label] ?? Icon.MapPinIcon;
                return (
                  <Pressable
                    key={place.id}
                    style={[styles.savedCard, { width: savedWidth }]}
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
                      <PIcon color={colors.primary} size={18} />
                    </View>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {placeTitle(place)}
                    </Txt>
                    <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                      {place.address}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {pastTrips.length ? (
          <View style={[styles.section, { paddingHorizontal: pad }]}>
            <Txt variant="title" style={styles.sectionTitle}>
              Past trips
            </Txt>
            <Card padded={false} elevation="soft">
              {pastTrips.slice(0, 4).map((trip, i) => (
                <Pressable
                  key={trip.id}
                  style={[styles.listRow, i > 0 && styles.listBorder]}
                  onPress={() =>
                    navigation.navigate('Map', {
                      origin: {
                        name: trip.originName,
                        address: trip.originAddress,
                        latitude: trip.originLatitude,
                        longitude: trip.originLongitude,
                      },
                      destination: {
                        id: trip.id,
                        name: trip.destinationName,
                        address: trip.destinationAddress,
                        latitude: trip.destinationLatitude,
                        longitude: trip.destinationLongitude,
                      },
                      tripId: Date.parse(trip.endedAt) || Date.now(),
                    })
                  }
                >
                  <View style={styles.listIcon}>
                    <Icon.RouteIcon color={colors.primary} size={18} />
                  </View>
                  <View style={styles.listCopy}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {trip.destinationName}
                    </Txt>
                    <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                      {formatDuration(trip.durationSeconds)} · {formatDistance(trip.distanceMeters)}
                    </Txt>
                  </View>
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}

        {recent.length ? (
          <View style={[styles.section, { paddingHorizontal: pad }]}>
            <Txt variant="title" style={styles.sectionTitle}>
              Recent
            </Txt>
            <Card padded={false} elevation="soft">
              {recent.slice(0, 4).map((r, i) => (
                <Pressable
                  key={r.id}
                  style={[styles.listRow, i > 0 && styles.listBorder]}
                  onPress={() =>
                    openOnMap(navigation, {
                      name: r.name,
                      address: r.address,
                      latitude: r.latitude,
                      longitude: r.longitude,
                    })
                  }
                >
                  <View style={[styles.listIcon, styles.recentIcon]}>
                    <Icon.ClockIcon color={colors.textDim} size={16} />
                  </View>
                  <View style={styles.listCopy}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {r.name}
                    </Txt>
                    <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                      {r.address}
                    </Txt>
                  </View>
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },

  header: {
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  searchBar: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  searchGo: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },

  section: { marginTop: spacing.xl },
  sectionTitle: { marginBottom: spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  catGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  catItem: { alignItems: 'center' },
  catIcon: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  catLabel: { marginTop: 8, width: '100%', color: colors.textDim },

  hRow: { gap: spacing.md, paddingRight: spacing.sm },
  savedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.soft,
  },
  savedIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentIcon: { backgroundColor: colors.surfaceAlt },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  listBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  listCopy: { flex: 1, minWidth: 0 },
});
