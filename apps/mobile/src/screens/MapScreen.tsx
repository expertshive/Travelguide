import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_LOCATION, formatDistance, formatDuration, originFrom } from '../lib/geo';
import {
  clearWatch,
  getCurrentPosition,
  requestLocationPermission,
  watchPosition,
} from '../lib/location';
import {
  listSavedPlaces,
  routeAlternatives,
  searchPlaces,
  TRAVEL_MODES,
  type LatLng,
  type Place,
  type Route,
  type RouteAvoid,
  type RoutePreference,
  type SavedPlace,
  type TravelMode,
} from '../lib/map';
import {
  bindVoice,
  destroyVoice,
  ensureMicPermission,
  startVoice,
  stopVoice,
} from '../lib/voice';
import { speak } from '../lib/tts';
import { DEFAULT_PREFS, loadAssistantPrefs, type AssistantPrefs } from '../lib/assistantPrefs';
import type { TabScreenProps } from '../navigation/types';
import { GOOGLE_MAPS_ENABLED } from '../config';
import type { AssistantAction, AssistantContext } from '../lib/assistant';
import { AssistantSheet } from './AssistantSheet';
import { Button, Field, Gradient, Icon, Txt, colors, radius, shadow, spacing } from '../ui';

type Props = TabScreenProps<'Map'>;

const DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 };
const OFF_ROUTE_METERS = 60;

type IconFn = (p: { color?: string; size?: number }) => React.ReactElement;

const MODE_META: Record<TravelMode, { label: string; icon: IconFn }> = {
  driving: { label: 'Drive', icon: Icon.CarIcon },
  motorcycle: { label: 'Moto', icon: Icon.NavigationIcon },
  walking: { label: 'Walk', icon: Icon.PersonIcon },
  cycling: { label: 'Cycle', icon: Icon.RouteIcon },
};

/** A Google-style icon + colour for a place, by its category (Google place type). */
function categoryMeta(category?: string): { Glyph: IconFn; color: string } {
  const c = (category ?? '').toLowerCase();
  if (/(cafe|bakery|coffee)/.test(c)) return { Glyph: Icon.CafeIcon, color: '#B4703B' };
  if (/(restaurant|food|meal|bar)/.test(c)) return { Glyph: Icon.FoodIcon, color: colors.accent };
  if (/(lodging|hotel|resort)/.test(c)) return { Glyph: Icon.HotelIcon, color: colors.info };
  if (/(gas|fuel|charg)/.test(c)) return { Glyph: Icon.FuelIcon, color: colors.text };
  if (/(store|shop|market|mall)/.test(c)) return { Glyph: Icon.CartIcon, color: colors.teal };
  if (/(hospital|pharmac|health|doctor|clinic)/.test(c)) return { Glyph: Icon.MedicalIcon, color: colors.danger };
  if (/(park|tourist|attraction|museum|point_of_interest|worship|mosque)/.test(c)) {
    return { Glyph: Icon.StarIcon, color: colors.star };
  }
  return { Glyph: Icon.MapPinIcon, color: colors.primary };
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const EDGE = { top: 150, right: 60, bottom: 320, left: 60 };

/** Categories the assistant proactively watches for along an active route. */
const INTERESTS = ['coffee', 'restaurant', 'fuel station', 'rest area', 'mosque'];
const SUGGEST_RADIUS_M = 1400;
const SUGGEST_INTERVAL_MS = 18000;

type PlanOpts = { mode?: TravelMode; preference?: RoutePreference; avoid?: RouteAvoid; stops?: LatLng[] };

export function MapScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const watchId = useRef<number | null>(null);

  const [region, setRegion] = useState<Region>({ ...DEFAULT_LOCATION, ...DELTA });
  const [me, setMe] = useState<LatLng | null>(null);
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [query, setQuery] = useState(route.params?.query ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeIndex, setRouteIndex] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Route selection options.
  const [mode, setMode] = useState<TravelMode>('driving');
  const [preference, setPreference] = useState<RoutePreference>('fastest');
  const [avoid, setAvoid] = useState<RouteAvoid>({ tolls: false, highways: false, ferries: false });
  const [stops, setStops] = useState<LatLng[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('hybrid');
  const [traffic, setTraffic] = useState(false);
  const [listening, setListening] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [prefs, setPrefs] = useState<AssistantPrefs>(DEFAULT_PREFS);
  const [suggestion, setSuggestion] = useState<{ place: Place; category: string; meters: number } | null>(null);

  useEffect(() => {
    void loadAssistantPrefs().then(setPrefs);
  }, []);

  const meRef = useRef<LatLng | null>(null);
  const suggestedIds = useRef<Set<string>>(new Set());
  const interestIdx = useRef(0);

  const primary = routes[routeIndex];
  const origin = me ?? originFrom(saved);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await requestLocationPermission();
      if (ok) {
        try {
          const pos = await getCurrentPosition();
          if (!active) return;
          setMe(pos);
          setRegion({ ...pos, ...DELTA });
          mapRef.current?.animateToRegion({ ...pos, ...DELTA }, 600);
        } catch {
          /* fall back to default region */
        }
      }
      listSavedPlaces()
        .then((s) => active && setSaved(s))
        .catch(() => {});
    })();
    return () => {
      active = false;
      if (watchId.current !== null) clearWatch(watchId.current);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchPlaces(q, origin, 10)
        .then(setResults)
        .catch(() => setResults([]));
    }, 320);
    return () => clearTimeout(t);
  }, [query]); // origin intentionally excluded to avoid re-searching on GPS drift

  const planRoute = useCallback(
    async (dest: Place, opts: PlanOpts = {}) => {
      const m = opts.mode ?? mode;
      const p = opts.preference ?? preference;
      const av = opts.avoid ?? avoid;
      const wp = opts.stops ?? stops;
      setSelected(dest);
      setResults([]);
      setPlanning(true);
      try {
        const result = await routeAlternatives({
          origin,
          destination: dest.center,
          waypoints: wp,
          mode: m,
          preference: p,
          avoid: av,
        });
        setRoutes(result);
        setRouteIndex(0);
        const geom = result[0]?.geometry?.length ? result[0].geometry : [origin, dest.center];
        setTimeout(
          () => mapRef.current?.fitToCoordinates(geom, { edgePadding: EDGE, animated: true }),
          150,
        );
      } catch {
        setRoutes([]);
      } finally {
        setPlanning(false);
      }
    },
    [origin, mode, preference, avoid, stops],
  );

  useEffect(() => {
    const d = route.params?.destination;
    if (d) {
      void planRoute({
        id: d.id ?? 'dest',
        name: d.name,
        address: d.address,
        center: { latitude: d.latitude, longitude: d.longitude },
      });
    }
  }, [route.params?.destination]); // planRoute intentionally omitted

  const steps = primary?.legs[0]?.steps ?? [];
  const currentStep = steps[stepIndex];
  const remaining = useMemo(() => {
    const rest = steps.slice(stepIndex);
    return {
      distance: rest.reduce((s, x) => s + x.distanceMeters, 0),
      duration: rest.reduce((s, x) => s + x.durationSeconds, 0),
    };
  }, [steps, stepIndex]);

  const offRoute =
    navigating && me && primary
      ? Math.min(...primary.geometry.map((p) => haversine(me, p))) > OFF_ROUTE_METERS
      : false;

  // Proactively look for places of interest near the traveller while driving,
  // announce them by voice, and offer to add them as a stop. No LLM needed.
  useEffect(() => {
    if (!navigating) return;
    const timer = setInterval(async () => {
      const here = meRef.current;
      if (!here || suggestion) return;
      const category = INTERESTS[interestIdx.current % INTERESTS.length];
      interestIdx.current += 1;
      try {
        const found = await searchPlaces(category, here, 6);
        const near = found
          .map((p) => ({ p, d: haversine(here, p.center) }))
          .filter(({ p, d }) => d < SUGGEST_RADIUS_M && !suggestedIds.current.has(p.id))
          .sort((a, b) => a.d - b.d)[0];
        if (near) {
          suggestedIds.current.add(near.p.id);
          setSuggestion({ place: near.p, category, meters: near.d });
          void speak(
            `There's a ${category} nearby — ${near.p.name}, about ${formatDistance(near.d)} away. Would you like to stop there?`,
          );
        }
      } catch {
        /* ignore a failed lookup */
      }
    }, SUGGEST_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [navigating, suggestion]);

  async function acceptSuggestion() {
    if (!suggestion) return;
    const place = suggestion.place;
    setSuggestion(null);
    void speak(`Great — adding ${place.name} to your route.`);
    await addStop(place);
  }

  // -- route option changes (explicit re-plan with the new value) ------------

  function changeMode(m: TravelMode) {
    setMode(m);
    if (selected) void planRoute(selected, { mode: m });
  }
  function changePreference(p: RoutePreference) {
    setPreference(p);
    if (selected) void planRoute(selected, { preference: p });
  }
  function toggleAvoid(key: keyof RouteAvoid) {
    const next = { ...avoid, [key]: !avoid[key] };
    setAvoid(next);
    if (selected) void planRoute(selected, { avoid: next });
  }
  async function addStop(place: Place) {
    const next = [...stops, place.center];
    setStops(next);
    if (selected) await planRoute(selected, { stops: next });
  }

  function startNavigation() {
    if (!primary) return;
    setNavigating(true);
    setStepIndex(0);
    watchId.current = watchPosition((pos) => {
      setMe(pos);
      mapRef.current?.animateCamera({ center: pos, zoom: 16 }, { duration: 600 });
      if (steps.length) {
        let best = stepIndex;
        let bestD = Infinity;
        steps.forEach((s, i) => {
          const d = haversine(pos, s.location);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        setStepIndex(best);
      }
    });
  }

  function stopNavigation() {
    if (watchId.current !== null) clearWatch(watchId.current);
    watchId.current = null;
    setNavigating(false);
  }

  function clearSelection() {
    setSelected(null);
    setRoutes([]);
    setStops([]);
  }

  function recenter() {
    if (me) mapRef.current?.animateToRegion({ ...me, ...DELTA }, 500);
  }

  function cycleMapType() {
    setMapType((t) => (t === 'standard' ? 'satellite' : t === 'satellite' ? 'hybrid' : 'standard'));
  }

  const assistantContext: AssistantContext = {
    destination: selected
      ? {
          name: selected.name,
          address: selected.address,
          latitude: selected.center.latitude,
          longitude: selected.center.longitude,
        }
      : undefined,
    origin,
    routeStyle: preference,
    mode,
    stops: stops.length ? stops.map((_, i) => `Stop ${i + 1}`) : undefined,
    distanceMeters: primary?.distanceMeters,
    durationSeconds: primary?.durationSeconds,
    assistant: { name: prefs.name, gender: prefs.gender, language: prefs.language },
  };

  async function onAssistantAction(action: AssistantAction) {
    switch (action.type) {
      case 'search':
        if (action.query) setQuery(action.query);
        setAssistantOpen(false);
        break;
      case 'add_stop':
        if (action.query) {
          try {
            const found = await searchPlaces(action.query, origin, 1);
            if (found[0]) {
              if (selected) await addStop(found[0]);
              else await planRoute(found[0]);
              setAssistantOpen(false);
            }
          } catch {
            /* nothing found */
          }
        }
        break;
      case 'remove_stop':
        if (stops.length) {
          const next = stops.slice(0, -1);
          setStops(next);
          if (selected) await planRoute(selected, { stops: next });
        } else {
          clearSelection();
        }
        break;
      case 'set_route_style':
        changePreference(action.routeStyle === 'shortest' ? 'shortest' : 'fastest');
        break;
      case 'start_navigation':
        if (primary) {
          startNavigation();
          setAssistantOpen(false);
        }
        break;
      default:
        break;
    }
  }

  useEffect(() => () => void destroyVoice(), []);

  async function toggleListening() {
    if (listening) {
      setListening(false);
      await stopVoice();
      return;
    }
    if (!(await ensureMicPermission())) return;
    bindVoice({
      onResult: (text) => {
        setQuery(text);
        setListening(false);
        void stopVoice();
      },
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    try {
      setQuery('');
      setListening(true);
      await startVoice(prefs.language);
    } catch {
      setListening(false);
    }
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={GOOGLE_MAPS_ENABLED ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        mapType={mapType}
        showsTraffic={traffic}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterests
        showsBuildings
        toolbarEnabled={false}
      >
        {saved.map((p) => (
          <Marker
            key={`saved-${p.id}`}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.label === 'CUSTOM' ? p.name : p.label === 'HOME' ? 'Home' : 'Work'}
            description={p.address}
          >
            <View style={[styles.pin, { backgroundColor: colors.teal }]}>
              <Icon.BookmarkIcon color={colors.onPrimary} size={14} />
            </View>
          </Marker>
        ))}

        {results.map((p) => {
          const { Glyph, color } = categoryMeta(p.category);
          return (
            <Marker
              key={`res-${p.id}`}
              coordinate={p.center}
              title={p.name}
              description={p.address}
              onPress={() => void planRoute(p)}
            >
              <View style={[styles.pin, { backgroundColor: color }]}>
                <Glyph color={colors.onPrimary} size={14} />
              </View>
            </Marker>
          );
        })}

        {stops.map((s, i) => (
          <Marker key={`stop-${i}`} coordinate={s} title={`Stop ${i + 1}`}>
            <View style={[styles.pin, { backgroundColor: colors.warning }]}>
              <Txt variant="caption" color={colors.onPrimary}>
                {i + 1}
              </Txt>
            </View>
          </Marker>
        ))}

        {selected ? (
          <Marker coordinate={selected.center} title={selected.name}>
            <View style={[styles.pin, styles.pinLarge, { backgroundColor: colors.accent }]}>
              <Icon.MapPinIcon color={colors.onPrimary} size={18} />
            </View>
          </Marker>
        ) : null}

        {/* All alternatives; the selected one is bold and on top */}
        {routes.map((r, i) =>
          i === routeIndex ? null : (
            <Polyline
              key={`alt-${r.id}`}
              coordinates={r.geometry}
              strokeColor="rgba(122,92,255,0.35)"
              strokeWidth={5}
              tappable
              onPress={() => setRouteIndex(i)}
              zIndex={1}
            />
          ),
        )}
        {primary ? (
          <Polyline
            coordinates={primary.geometry}
            strokeColor={colors.primary}
            strokeWidth={6}
            zIndex={2}
          />
        ) : null}
      </MapView>

      {/* Top overlay */}
      {navigating ? (
        <View style={[styles.navBanner, { top: insets.top + spacing.sm }]}>
          <View style={styles.navManeuver}>
            <Icon.NavigationIcon color={colors.onPrimary} size={26} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong" color={colors.onPrimary} numberOfLines={2}>
              {currentStep?.instruction || 'Continue on route'}
            </Txt>
            <Txt variant="small" color="rgba(255,255,255,0.85)">
              {currentStep ? formatDistance(currentStep.distanceMeters) : ''}
            </Txt>
          </View>
        </View>
      ) : (
        <View style={[styles.searchWrap, { top: insets.top + spacing.sm }]}>
          <Field
            placeholder={listening ? 'Listening…' : 'Search or speak a place…'}
            value={query}
            onChangeText={setQuery}
            left={<Icon.SearchIcon color={colors.textDim} size={20} />}
            right={
              query && !listening ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Icon.CloseIcon color={colors.textFaint} size={18} />
                </Pressable>
              ) : (
                <Pressable onPress={() => void toggleListening()} hitSlop={8}>
                  <View style={[styles.mic, listening && styles.micOn]}>
                    <Icon.MicIcon color={listening ? colors.onPrimary : colors.primary} size={18} />
                  </View>
                </Pressable>
              )
            }
            style={styles.noMargin}
          />
          {results.length ? (
            <View style={styles.results}>
              {results.slice(0, 5).map((p) => {
                const { Glyph, color } = categoryMeta(p.category);
                return (
                  <Pressable key={p.id} style={styles.resultRow} onPress={() => void planRoute(p)}>
                    <View style={[styles.resultIcon, { backgroundColor: color }]}>
                      <Glyph color={colors.onPrimary} size={16} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong" numberOfLines={1}>
                        {p.name}
                      </Txt>
                      <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                        {p.address}
                      </Txt>
                    </View>
                    {selected ? (
                      <Pressable
                        hitSlop={8}
                        style={styles.addStop}
                        onPress={() => void addStop(p)}
                      >
                        <Icon.PlusIcon color={colors.primary} size={16} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      )}

      {/* Map controls: layer type + live traffic */}
      <View style={[styles.controls, { bottom: (navigating ? 214 : 300) + insets.bottom }]}>
        <Pressable style={styles.ctrlBtn} onPress={cycleMapType}>
          <Icon.LayersIcon color={mapType === 'standard' ? colors.text : colors.primary} size={20} />
          <Txt variant="caption" color={mapType === 'standard' ? colors.textDim : colors.primary}>
            {mapType === 'standard' ? 'MAP' : mapType === 'satellite' ? 'SAT' : 'HYB'}
          </Txt>
        </Pressable>
        <Pressable
          style={[styles.ctrlBtn, traffic && styles.ctrlBtnOn]}
          onPress={() => setTraffic((v) => !v)}
        >
          <Icon.TrafficIcon color={traffic ? colors.onPrimary : colors.text} size={20} />
        </Pressable>
      </View>

      {/* Recenter FAB */}
      <Pressable
        style={[styles.fab, { bottom: (navigating ? 150 : 236) + insets.bottom }]}
        onPress={recenter}
      >
        <Icon.NavigationIcon color={colors.primary} size={22} />
      </Pressable>

      {/* AI voice assistant */}
      <Pressable
        style={[styles.assistantFab, { bottom: (navigating ? 150 : 236) + insets.bottom }]}
        onPress={() => setAssistantOpen(true)}
      >
        <Gradient name="candy" style={styles.assistantFabInner}>
          <Icon.SparkleIcon color={colors.onPrimary} size={24} />
        </Gradient>
      </Pressable>

      {offRoute ? (
        <View style={[styles.reroute, { bottom: 300 + insets.bottom }]}>
          <Txt variant="small" color={colors.onPrimary}>
            You're off route
          </Txt>
          <Pressable style={styles.rerouteBtn} onPress={() => selected && void planRoute(selected)}>
            <Txt variant="small" color={colors.primary}>
              Reroute
            </Txt>
          </Pressable>
        </View>
      ) : null}

      {/* Proactive suggestion */}
      {suggestion ? (
        (() => {
          const { Glyph, color } = categoryMeta(suggestion.place.category ?? suggestion.category);
          return (
            <View style={[styles.suggestion, { bottom: (navigating ? 130 : 320) + insets.bottom }]}>
              <View style={[styles.suggestIcon, { backgroundColor: color }]}>
                <Glyph color={colors.onPrimary} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong" numberOfLines={1}>
                  {suggestion.place.name}
                </Txt>
                <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                  {suggestion.category} • {formatDistance(suggestion.meters)} away — add a stop?
                </Txt>
              </View>
              <Pressable onPress={() => setSuggestion(null)} hitSlop={8} style={styles.suggestNo}>
                <Icon.CloseIcon color={colors.textDim} size={18} />
              </Pressable>
              <Button title="Add" size="md" full={false} onPress={() => void acceptSuggestion()} />
            </View>
          );
        })()
      ) : null}

      {/* Bottom sheet */}
      {selected ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          {navigating ? (
            <View style={styles.navControls}>
              <View style={styles.navStats}>
                <Txt variant="h3">{formatDuration(remaining.duration)}</Txt>
                <Txt variant="small" color={colors.textDim}>
                  {formatDistance(remaining.distance)} • {selected.name}
                </Txt>
              </View>
              <Button
                title="End"
                variant="danger"
                full={false}
                onPress={stopNavigation}
                style={{ minWidth: 110 }}
              />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
              <View style={styles.sheetHead}>
                <View style={styles.sheetPin}>
                  <Icon.MapPinIcon color={colors.primary} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {selected.name}
                  </Txt>
                  <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                    {primary
                      ? `${formatDuration(primary.durationSeconds)} • ${formatDistance(primary.distanceMeters)}${stops.length ? ` • ${stops.length} stop${stops.length > 1 ? 's' : ''}` : ''}`
                      : planning
                        ? 'Planning route…'
                        : selected.address}
                  </Txt>
                </View>
                <Pressable onPress={clearSelection} hitSlop={8} style={styles.close}>
                  <Icon.CloseIcon color={colors.textDim} size={18} />
                </Pressable>
              </View>

              {/* Travel modes */}
              <View style={styles.modes}>
                {TRAVEL_MODES.map((m) => {
                  const active = m === mode;
                  const { label, icon: MIcon } = MODE_META[m];
                  return (
                    <Pressable
                      key={m}
                      style={[styles.mode, active && styles.modeActive]}
                      onPress={() => changeMode(m)}
                    >
                      <MIcon color={active ? colors.onPrimary : colors.textDim} size={18} />
                      <Txt variant="caption" color={active ? colors.onPrimary : colors.textDim}>
                        {label}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>

              {/* Route alternatives */}
              {routes.length > 1 ? (
                <View style={styles.alts}>
                  {routes.map((r, i) => {
                    const active = i === routeIndex;
                    return (
                      <Pressable
                        key={r.id}
                        style={[styles.alt, active && styles.altActive]}
                        onPress={() => setRouteIndex(i)}
                      >
                        <Txt variant="bodyStrong" color={active ? colors.primary : colors.text}>
                          {formatDuration(r.durationSeconds)}
                        </Txt>
                        <Txt variant="small" color={colors.textDim}>
                          {formatDistance(r.distanceMeters)} · {i === 0 ? 'Best' : r.summary || `Alt ${i}`}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Options */}
              <Pressable style={styles.optionsToggle} onPress={() => setOptionsOpen((o) => !o)}>
                <Icon.SettingsIcon color={colors.textDim} size={16} />
                <Txt variant="small" color={colors.textDim} style={{ flex: 1 }}>
                  Route options
                </Txt>
                <Icon.ChevronRightIcon
                  color={colors.textFaint}
                  size={16}
                />
              </Pressable>
              {optionsOpen ? (
                <View style={styles.options}>
                  <View style={styles.optRow}>
                    {(['fastest', 'shortest'] as RoutePreference[]).map((p) => (
                      <Pressable
                        key={p}
                        style={[styles.chip, preference === p && styles.chipOn]}
                        onPress={() => changePreference(p)}
                      >
                        <Txt
                          variant="small"
                          color={preference === p ? colors.onPrimary : colors.text}
                        >
                          {p === 'fastest' ? 'Fastest' : 'Shortest'}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.optRow}>
                    {(['tolls', 'highways', 'ferries'] as (keyof RouteAvoid)[]).map((k) => (
                      <Pressable
                        key={k}
                        style={[styles.chip, avoid[k] && styles.chipOn]}
                        onPress={() => toggleAvoid(k)}
                      >
                        <Txt variant="small" color={avoid[k] ? colors.onPrimary : colors.text}>
                          Avoid {k}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <Button
                title="Start"
                left={<Icon.NavigationIcon color={colors.onPrimary} size={18} />}
                disabled={!primary}
                onPress={startNavigation}
                style={{ marginTop: spacing.md }}
              />
            </ScrollView>
          )}
        </View>
      ) : null}

      {assistantOpen ? (
        <AssistantSheet
          context={assistantContext}
          persona={{ name: prefs.name, language: prefs.language }}
          onClose={() => setAssistantOpen(false)}
          onAction={(a) => void onAssistantAction(a)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    ...shadow.soft,
  },
  pinLarge: { width: 38, height: 38, borderRadius: 19 },

  searchWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  noMargin: {},
  mic: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOn: { backgroundColor: colors.danger },
  results: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    ...shadow.card,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStop: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navBanner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.lifted,
  },
  navManeuver: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  controls: {
    position: 'absolute',
    right: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  ctrlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  ctrlBtnOn: { backgroundColor: colors.primary },
  assistantFab: {
    position: 'absolute',
    left: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...shadow.lifted,
  },
  assistantFabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reroute: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.danger,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    ...shadow.lifted,
  },
  rerouteBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },

  sheet: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxxl + spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  sheetPin: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { padding: spacing.xs },

  modes: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  mode: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  modeActive: { backgroundColor: colors.primary },

  alts: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  alt: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  altActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },

  optionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  options: { gap: spacing.sm, marginBottom: spacing.sm },
  optRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },

  navControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navStats: { flex: 1 },

  suggestion: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.lifted,
  },
  suggestIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestNo: { padding: spacing.xs },
});
