import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { formatDistance, formatDuration, originFrom } from '../lib/geo';
import { locateUser } from '../lib/location';
import {
  calculateRoute,
  listSavedPlaces,
  savePlace,
  type LatLng,
  type Route,
  type SavedPlace,
  type TravelMode,
} from '../lib/map';
import type { AppScreenProps } from '../navigation/types';
import {
  Button,
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

type Props = AppScreenProps<'PlaceDetail'>;
type IconType = (p: { color?: string; size?: number }) => React.ReactElement;

const MODES: { mode: TravelMode; label: string; icon: IconType }[] = [
  { mode: 'driving', label: 'Drive', icon: Icon.CarIcon },
  { mode: 'walking', label: 'Walk', icon: Icon.PersonIcon },
  { mode: 'cycling', label: 'Cycle', icon: Icon.RouteIcon },
];

const MAP_H = 200;

export function PlaceDetailScreen({ navigation, route: nav }: Props) {
  const { place } = nav.params;
  const destination: LatLng = { latitude: place.latitude, longitude: place.longitude };

  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [me, setMe] = useState<LatLng | null>(null);
  const [mode, setMode] = useState<TravelMode>('driving');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSavedPlaces()
      .then(setSaved)
      .catch(() => setSaved([]));
    void locateUser().then((result) => {
      if (result.ok) setMe(result.position);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const origin = originFrom(me, saved);
    if (!origin) {
      setRoutes([]);
      setLoading(false);
      setError('Turn on location to plan a route from where you are.');
      return;
    }
    setLoading(true);
    setError(null);
    calculateRoute({ origin, destination, mode, preference: 'fastest' })
      .then((result) => {
        if (active) setRoutes(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not plan a route');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // Re-plan when the mode, GPS, or saved origin changes.
  }, [mode, saved, me, destination.latitude, destination.longitude]);

  const primary = routes[0];
  const origin = originFrom(me, saved);

  const onSave = () => {
    Alert.alert('Save place', `Save "${place.name}" as…`, [
      { text: 'Home', onPress: () => void doSave('HOME') },
      { text: 'Work', onPress: () => void doSave('WORK') },
      { text: 'Favourite', onPress: () => void doSave('CUSTOM') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const doSave = async (label: SavedPlace['label']) => {
    try {
      await savePlace({
        label,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
      });
      Alert.alert('Saved', `"${place.name}" was added to your places.`);
      setSaved(await listSavedPlaces());
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Map hero with the real route drawn */}
        <Gradient name="ocean" style={styles.map}>
          <View style={styles.mapTop}>
            <IconButton bg="rgba(255,255,255,0.22)" onPress={() => navigation.goBack()}>
              <Icon.BackIcon color={colors.onPrimary} size={20} />
            </IconButton>
            <IconButton bg="rgba(255,255,255,0.22)" onPress={onSave}>
              <Icon.BookmarkIcon color={colors.onPrimary} size={20} />
            </IconButton>
          </View>
          <RoutePolyline geometry={primary?.geometry ?? []} origin={origin} destination={destination} />
        </Gradient>

        {/* Place card overlapping the map */}
        <View style={styles.body}>
          <Card style={styles.placeCard}>
            <View style={styles.placeHead}>
              <View style={styles.placePin}>
                <Icon.MapPinIcon color={colors.primary} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="h3" numberOfLines={2}>
                  {place.name}
                </Txt>
                <Txt variant="small" color={colors.textDim} numberOfLines={2}>
                  {place.address}
                </Txt>
              </View>
            </View>

            {/* Travel mode selector */}
            <View style={styles.modes}>
              {MODES.map(({ mode: m, label, icon: MIcon }) => {
                const active = m === mode;
                return (
                  <Pressable
                    key={m}
                    style={[styles.mode, active && styles.modeActive]}
                    onPress={() => setMode(m)}
                  >
                    <MIcon color={active ? colors.onPrimary : colors.textDim} size={18} />
                    <Txt variant="small" color={active ? colors.onPrimary : colors.textDim}>
                      {label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>

            {/* Route summary */}
            {loading ? (
              <View style={styles.summaryLoading}>
                <Txt variant="small" color={colors.textDim}>
                  Planning your route…
                </Txt>
              </View>
            ) : error ? (
              <View style={styles.summaryLoading}>
                <Txt variant="small" color={colors.danger}>
                  {error}
                </Txt>
              </View>
            ) : primary ? (
              <View style={styles.summary}>
                <Stat icon={Icon.ClockIcon} value={formatDuration(primary.durationSeconds)} label="Duration" />
                <View style={styles.summaryDivider} />
                <Stat icon={Icon.RouteIcon} value={formatDistance(primary.distanceMeters)} label="Distance" />
                <View style={styles.summaryDivider} />
                <Stat icon={Icon.NavigationIcon} value={primary.summary || 'Fastest'} label="Route" />
              </View>
            ) : null}
          </Card>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Save place"
              variant="secondary"
              full={false}
              style={{ flex: 1 }}
              left={<Icon.BookmarkIcon color={colors.primarySoftText} size={18} />}
              onPress={onSave}
            />
            <Button
              title="Start"
              full={false}
              style={{ flex: 1 }}
              left={<Icon.NavigationIcon color={colors.onPrimary} size={18} />}
              onPress={() =>
                navigation.navigate('Tabs', {
                  screen: 'Map',
                  params: {
                    destination: place,
                    origin: me
                      ? {
                          name: 'Your location',
                          address: 'Current position',
                          latitude: me.latitude,
                          longitude: me.longitude,
                        }
                      : undefined,
                    autoStart: true,
                    tripId: Date.now(),
                  },
                })
              }
            />
          </View>

          {/* Turn-by-turn steps */}
          {primary && primary.legs[0]?.steps.length ? (
            <View style={styles.steps}>
              <Txt variant="h3" style={{ marginBottom: spacing.md }}>
                Steps
              </Txt>
              <Card padded={false} elevation="soft">
                {primary.legs[0].steps.slice(0, 12).map((step, i) => (
                  <View
                    key={`${i}-${step.instruction}`}
                    style={[styles.step, i > 0 && styles.stepBorder]}
                  >
                    <View style={styles.stepDot}>
                      <Txt variant="caption" color={colors.primary}>
                        {i + 1}
                      </Txt>
                    </View>
                    <Txt variant="body" style={{ flex: 1 }}>
                      {step.instruction || 'Continue'}
                    </Txt>
                    <Txt variant="small" color={colors.textFaint}>
                      {formatDistance(step.distanceMeters)}
                    </Txt>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ icon: I, value, label }: { icon: IconType; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <I color={colors.primary} size={18} />
      <Txt variant="bodyStrong" numberOfLines={1} style={{ marginTop: 4 }}>
        {value}
      </Txt>
      <Txt variant="caption" color={colors.textFaint}>
        {label.toUpperCase()}
      </Txt>
    </View>
  );
}

/** Draws the route geometry inside the hero using react-native-svg. */
function RoutePolyline({
  geometry,
  origin,
  destination,
}: {
  geometry: LatLng[];
  origin: LatLng | null;
  destination: LatLng;
}) {
  const [w, setW] = useState(0);

  const path = useMemo(() => {
    const pts = geometry.length >= 2 ? geometry : origin ? [origin, destination] : [destination];
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 0.0001;
    const spanLng = maxLng - minLng || 0.0001;
    const pad = 26;
    const innerW = Math.max(w - pad * 2, 1);
    const innerH = MAP_H - pad * 2;
    const project = (p: LatLng) => {
      const x = pad + ((p.longitude - minLng) / spanLng) * innerW;
      const y = pad + (1 - (p.latitude - minLat) / spanLat) * innerH;
      return [x, y] as const;
    };
    const projected = pts.map(project);
    const d = projected
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ');
    const start = projected[0];
    const end = projected[projected.length - 1];
    return { d, start, end };
  }, [geometry, origin, destination, w]);

  return (
    <View style={styles.mapCanvas} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={MAP_H}>
          <Path
            d={path.d}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={path.start[0]} cy={path.start[1]} r={7} fill="#fff" />
          <Circle cx={path.start[0]} cy={path.start[1]} r={3.5} fill={colors.teal} />
          <Circle cx={path.end[0]} cy={path.end[1]} r={7} fill="#fff" />
          <Circle cx={path.end[0]} cy={path.end[1]} r={3.5} fill={colors.accent} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },

  map: { height: 300, paddingTop: spacing.xxxl, paddingHorizontal: spacing.xl },
  mapTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapCanvas: { position: 'absolute', left: 0, right: 0, bottom: 40, height: MAP_H },

  body: { marginTop: -70, paddingHorizontal: spacing.xl },
  placeCard: {},
  placeHead: { flexDirection: 'row', gap: spacing.md },
  placePin: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  mode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  modeActive: { backgroundColor: colors.primary },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryLoading: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },
  stat: { flex: 1, alignItems: 'center', gap: 1 },

  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },

  steps: { marginTop: spacing.xxl },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stepBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
