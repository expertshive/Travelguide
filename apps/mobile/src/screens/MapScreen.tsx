import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  UrlTile,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistance, formatDuration, originFrom, regionForRadius } from '../lib/geo';
import {
  clearWatch,
  locateUser,
  openAppSettings,
  openLocationSettings,
  peekLastLocation,
  promptAllowLocation,
  promptEnableGps,
  watchPosition,
  type LocationIssue,
} from '../lib/location';
import {
  listSavedPlaces,
  routeAlternatives,
  savePlace,
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
import { destroyVoice } from '../lib/voice';
import { speak, setAssistantVoice, stopSpeaking } from '../lib/tts';
import {
  DEFAULT_PREFS,
  loadAssistantPrefs,
  mapsLanguage,
  spokenCopy,
  type AssistantPrefs,
} from '../lib/assistantPrefs';
import { setTabBarHidden } from '../lib/tabBarVisibility';
import type { TabScreenProps } from '../navigation/types';
import { GOOGLE_MAPS_ENABLED, OSM_SATELLITE_TILES, OSM_STREET_TILES } from '../config';
import type { AssistantAction, AssistantContext } from '../lib/assistant';
import { AssistantSheet } from './AssistantSheet';
import { useAuth } from '../context/AuthContext';
import { Avatar, Button, Gradient, Icon, Loader, Txt, colors, radius, shadow, spacing } from '../ui';

type Props = TabScreenProps<'Map'>;

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

function cleanInstruction(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

const EDGE = { top: 160, right: 48, bottom: 280, left: 48 };
const ARRIVE_METERS = 45;

/** Android's default map provider is Google; without a key, overlay OSM tiles. */
const USE_OSM_TILES = Platform.OS === 'android' && !GOOGLE_MAPS_ENABLED;

/** Famous / tourist places the assistant announces on its own while traveling. */
const FAMOUS_QUERIES = ['tourist attraction', 'landmark', 'museum', 'historical site'];
const FAMOUS_LABEL = 'famous place';
const SUGGEST_INTERVAL_MS = 18000;
const DEFAULT_RADIUS_M = 2000;
const RADIUS_OPTIONS = [
  [500, '500m'],
  [1000, '1km'],
  [2000, '2km'],
  [5000, '5km'],
  [10000, '10km'],
] as const;

type PlanOpts = {
  mode?: TravelMode;
  preference?: RoutePreference;
  avoid?: RouteAvoid;
  stops?: Place[];
  from?: LatLng;
};
type TripField = 'start' | 'end' | number;
const MAX_STOPS = 4;
const EXPLORE_TITLES: Record<string, string> = {
  restaurant: 'Restaurants nearby',
  hotel: 'Hotels nearby',
  cafe: 'Coffee nearby',
  'gas station': 'Fuel nearby',
  'tourist attraction': 'Attractions nearby',
};

function exploreTitle(query: string): string {
  return EXPLORE_TITLES[query.toLowerCase()] ?? `${query} nearby`;
}

export function MapScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const watchId = useRef<number | null>(null);
  const navWatchId = useRef<number | null>(null);
  const spokenStep = useRef(-1);
  const arrived = useRef(false);
  const offRouteSpoken = useRef(false);
  const stepsRef = useRef<Route['legs'][number]['steps']>([]);
  const stepIndexRef = useRef(0);
  const destRef = useRef<Place | null>(null);

  const [region, setRegion] = useState<Region | null>(() => {
    const cached = peekLastLocation();
    return cached ? regionForRadius(cached, DEFAULT_RADIUS_M) : null;
  });
  const [me, setMe] = useState<LatLng | null>(() => peekLastLocation());
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
  const [startPlace, setStartPlace] = useState<Place | null>(null);
  const [stopPlaces, setStopPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<TripField>('end');
  const [optionsOpen, setOptionsOpen] = useState(false);

  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [traffic, setTraffic] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [locationIssue, setLocationIssue] = useState<LocationIssue | null>(null);
  const [findingLocation, setFindingLocation] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [prefs, setPrefs] = useState<AssistantPrefs>(DEFAULT_PREFS);
  const [suggestion, setSuggestion] = useState<{ place: Place; category: string; meters: number } | null>(null);
  const [searchRadiusM, setSearchRadiusM] = useState(DEFAULT_RADIUS_M);
  const [browseQuery, setBrowseQuery] = useState<string | null>(null);
  const [endSearching, setEndSearching] = useState(true);
  const [stepsOpen, setStepsOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadAssistantPrefs().then((loaded) => {
        setPrefs(loaded);
        void setAssistantVoice(loaded.gender, loaded.language);
      });
    }, []),
  );

  const meRef = useRef<LatLng | null>(null);
  const radiusRef = useRef(DEFAULT_RADIUS_M);
  const suggestedIds = useRef<Set<string>>(new Set());
  const interestIdx = useRef(0);
  const plannedKey = useRef<string | null>(null);
  const autoStarted = useRef(false);

  const primary = routes[routeIndex];
  const origin = useMemo(() => {
    if (startPlace) return startPlace.center;
    const fromParams = route.params?.origin;
    if (fromParams) {
      return { latitude: fromParams.latitude, longitude: fromParams.longitude };
    }
    return originFrom(me, saved);
  }, [startPlace, route.params?.origin, me, saved]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    radiusRef.current = searchRadiusM;
  }, [searchRadiusM]);

  useEffect(() => {
    destRef.current = selected;
  }, [selected]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const cached = peekLastLocation();
        if (cached && active) {
          setMe(cached);
          setRegion(regionForRadius(cached, DEFAULT_RADIUS_M));
          setLocationIssue(null);
          setFindingLocation(false);
        } else {
          setFindingLocation(true);
        }
        const result = await locateUser();
        if (!active) return;
        if (result.ok) {
          setMe(result.position);
          setRegion(regionForRadius(result.position, radiusRef.current));
          setLocationIssue(null);
          mapRef.current?.animateToRegion(regionForRadius(result.position, radiusRef.current), 500);
        } else if (!cached) {
          setLocationIssue(result.reason);
        }
        setFindingLocation(false);
        listSavedPlaces()
          .then((s) => active && setSaved(s))
          .catch(() => {});
      })();
      return () => {
        active = false;
        if (watchId.current !== null) {
          clearWatch(watchId.current);
          watchId.current = null;
        }
      };
    }, []),
  );

  // Home "Explore nearby" / featured: pins on the map, not text in the END field.
  useFocusEffect(
    useCallback(() => {
      const explore = route.params?.explore?.trim();
      const incoming = route.params?.query?.trim();
      if (explore) {
        setBrowseQuery(explore);
        setQuery('');
        setEditing('end');
        setSelected(null);
        setRoutes([]);
        setStopPlaces([]);
        setBanner(null);
        const near = origin ?? meRef.current ?? undefined;
        void searchPlaces(explore, near, 15)
          .then((places) => {
            setResults(places);
            if (!places.length) {
              setBanner(`No ${explore} found nearby.`);
              return;
            }
            const pts = near ? [near, ...places.map((p) => p.center)] : places.map((p) => p.center);
            mapRef.current?.fitToCoordinates(pts, { edgePadding: EDGE, animated: true });
          })
          .catch((err: unknown) => {
            setResults([]);
            setBanner(err instanceof Error ? err.message : 'Search failed');
          });
        navigation.setParams({ explore: undefined, query: undefined });
        return;
      }
      if (!incoming) return;
      setBrowseQuery(null);
      setEditing('end');
      setSelected(null);
      setRoutes([]);
      setStopPlaces([]);
      setQuery(incoming);
      navigation.setParams({ query: undefined });
    }, [navigation, origin, route.params?.explore, route.params?.query]),
  );

  useEffect(() => {
    if (browseQuery) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchPlaces(q, origin ?? undefined, 10)
        .then((places) => {
          setResults(places);
          setBanner(places.length ? null : `No places found for “${q}”.`);
        })
        .catch((err: unknown) => {
          setResults([]);
          setBanner(err instanceof Error ? err.message : 'Search failed');
        });
    }, 320);
    return () => clearTimeout(t);
  }, [browseQuery, query]); // origin intentionally excluded to avoid re-searching on GPS drift

  const planRoute = useCallback(
    async (dest: Place, opts: PlanOpts = {}) => {
      let from = opts.from ?? origin;
      if (!from) {
        const found = await locateUser();
        if (found.ok) {
          from = found.position;
          setMe(found.position);
          setLocationIssue(null);
        } else {
          setLocationIssue(found.reason);
          setBanner('Turn on location so we can start the route from where you are.');
          return null;
        }
      }
      const m = opts.mode ?? mode;
      const p = opts.preference ?? preference;
      const av = opts.avoid ?? avoid;
      setSelected(dest);
      setBrowseQuery(null);
      setEditing('end');
      setEndSearching(false);
      setResults([]);
      setQuery('');
      setPlanning(true);
      try {
        const result = await routeAlternatives({
          origin: from,
          destination: dest.center,
          waypoints: (opts.stops ?? stopPlaces).map((s) => s.center),
          mode: m,
          preference: p,
          avoid: av,
          language: mapsLanguage(prefs.language),
        });
        setRoutes(result);
        setRouteIndex(0);
        const geom = result[0]?.geometry?.length ? result[0].geometry : [from, dest.center];
        setTimeout(
          () => mapRef.current?.fitToCoordinates(geom, { edgePadding: EDGE, animated: true }),
          150,
        );
        setBanner(null);
        return result[0] ?? null;
      } catch (err: unknown) {
        setRoutes([]);
        setBanner(err instanceof Error ? err.message : 'Could not plan a route. Try again.');
        return null;
      } finally {
        setPlanning(false);
      }
    },
    [origin, mode, preference, avoid, stopPlaces, prefs.language],
  );

  useEffect(() => {
    const d = route.params?.destination;
    if (!d || !origin) return;
    const key = `${route.params?.tripId ?? ''}|${d.latitude},${d.longitude}|${origin.latitude},${origin.longitude}|${prefs.language}`;
    if (plannedKey.current === key) return;
    plannedKey.current = key;
    autoStarted.current = false;
    void planRoute({
      id: d.id ?? 'dest',
      name: d.name,
      address: d.address,
      center: { latitude: d.latitude, longitude: d.longitude },
    });
  }, [route.params?.destination, route.params?.tripId, origin, planRoute]);

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

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    if (!navigating) {
      offRouteSpoken.current = false;
      return;
    }
    if (offRoute && !offRouteSpoken.current) {
      offRouteSpoken.current = true;
      void speak(spokenCopy(prefs.language).offRoute);
    }
    if (!offRoute) offRouteSpoken.current = false;
  }, [offRoute, navigating, prefs.language]);

  useEffect(() => {
    if (!navigating || stepIndex === 0) return;
    if (spokenStep.current === stepIndex) return;
    spokenStep.current = stepIndex;
    const step = steps[stepIndex];
    const text = cleanInstruction(step?.instruction ?? '');
    if (text) void speak(text);
  }, [navigating, stepIndex, steps]);

  // While driving, only announce famous places inside the chosen radius.
  // Restaurants and rest areas wait until the traveler asks.
  useEffect(() => {
    if (!navigating) return;
    const timer = setInterval(async () => {
      const here = meRef.current;
      if (!here || suggestion) return;
      const query = FAMOUS_QUERIES[interestIdx.current % FAMOUS_QUERIES.length];
      interestIdx.current += 1;
      try {
        const found = await searchPlaces(query, here, 8);
        const cap = radiusRef.current;
        const near = found
          .map((p) => ({ p, d: haversine(here, p.center) }))
          .filter(({ p, d }) => d <= cap && !suggestedIds.current.has(p.id))
          .sort((a, b) => a.d - b.d)[0];
        if (near) {
          suggestedIds.current.add(near.p.id);
          setSuggestion({ place: near.p, category: FAMOUS_LABEL, meters: near.d });
          void speak(
            spokenCopy(prefs.language).nearby(
              FAMOUS_LABEL,
              near.p.name,
              formatDistance(near.d),
            ),
          );
        }
      } catch {
        /* ignore a failed lookup */
      }
    }, SUGGEST_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [navigating, suggestion, prefs.language]);

  async function acceptSuggestion() {
    if (!suggestion) return;
    const place = suggestion.place;
    setSuggestion(null);
    void speak(spokenCopy(prefs.language).adding(place.name));
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
    if (stopPlaces.length >= MAX_STOPS) {
      setBanner(`You can add up to ${MAX_STOPS} stops.`);
      return;
    }
    const next = [...stopPlaces, place];
    setStopPlaces(next);
    setQuery('');
    setResults([]);
    if (selected) await planRoute(selected, { stops: next });
  }

  function removeStop(index: number) {
    const next = stopPlaces.filter((_, i) => i !== index);
    setStopPlaces(next);
    if (selected) void planRoute(selected, { stops: next });
  }

  function pickSearchResult(place: Place) {
    if (editing === 'start') {
      setStartPlace(place);
      setQuery('');
      setResults([]);
      if (selected) void planRoute(selected, { from: place.center });
      return;
    }
    if (typeof editing === 'number') {
      if (editing >= stopPlaces.length) {
        void addStop(place);
        setEditing('end');
        return;
      }
      const next = stopPlaces.map((s, i) => (i === editing ? place : s));
      setStopPlaces(next);
      setQuery('');
      setResults([]);
      setEditing('end');
      if (selected) void planRoute(selected, { stops: next });
      return;
    }
    if (routes.length) {
      void planRoute(place);
      return;
    }
    void previewPlace(place);
  }

  function previewPlace(place: Place) {
    setBrowseQuery(null);
    setEditing('end');
    setEndSearching(false);
    setSelected(place);
    setRoutes([]);
    setQuery('');
    mapRef.current?.animateCamera({ center: place.center, zoom: 15 }, { duration: 420 });
  }

  function chooseDestination(place: Place) {
    previewPlace(place);
  }

  function swapTripEnds() {
    if (!selected || !origin) return;
    const nextStart = selected;
    const nextEnd = startPlace ?? {
      id: 'here',
      name: 'Your location',
      address: '',
      center: origin,
    };
    setStartPlace(nextStart);
    void planRoute(nextEnd, { from: nextStart.center });
  }

  async function sharePlace(place: Place) {
    try {
      await Share.share({
        title: place.name,
        message: place.address ? `${place.name}\n${place.address}` : place.name,
      });
    } catch {
      /* user cancelled */
    }
  }

  async function bookmarkPlace(place: Place) {
    try {
      const next = await savePlace({
        label: 'CUSTOM',
        name: place.name,
        address: place.address,
        latitude: place.center.latitude,
        longitude: place.center.longitude,
      });
      setSaved(next);
      setBanner(`Saved ${place.name}`);
    } catch (err: unknown) {
      setBanner(err instanceof Error ? err.message : 'Could not save this place.');
    }
  }

  async function beginTrip() {
    if (navigating) return;
    let planned = routes[routeIndex];
    if (!planned) {
      const destParam = route.params?.destination;
      const dest =
        selected ??
        (destParam
          ? {
              id: destParam.id ?? 'dest',
              name: destParam.name,
              address: destParam.address,
              center: {
                latitude: destParam.latitude,
                longitude: destParam.longitude,
              },
            }
          : null);
      if (!dest) {
        setBanner('Choose a destination, then tap Start trip.');
        return;
      }
      const next = await planRoute(dest);
      if (!next) return;
      planned = next;
    }
    startGuidance(planned);
  }

  function startGuidance(route: Route) {
    const list = route.legs[0]?.steps ?? [];
    stepsRef.current = list;
    stepIndexRef.current = 0;
    spokenStep.current = 0;
    arrived.current = false;
    setStepIndex(0);
    setNavigating(true);
    setTabBarHidden(true);

    if (navWatchId.current !== null) clearWatch(navWatchId.current);
    navWatchId.current = watchPosition((pos) => {
      setMe(pos);
      mapRef.current?.animateCamera({ center: pos, zoom: 16 }, { duration: 600 });
      const nextSteps = stepsRef.current;
      let idx = stepIndexRef.current;
      while (idx < nextSteps.length - 1) {
        const here = haversine(pos, nextSteps[idx].location);
        const ahead = haversine(pos, nextSteps[idx + 1].location);
        if (here < 35 || ahead < here) idx += 1;
        else break;
      }
      if (idx !== stepIndexRef.current) {
        stepIndexRef.current = idx;
        setStepIndex(idx);
      }
      const dest = destRef.current;
      if (!arrived.current && dest && haversine(pos, dest.center) < ARRIVE_METERS) {
        arrived.current = true;
        const name = dest.name;
        void speak(spokenCopy(prefs.language).arrived(name));
      }
    });

    const destName = destRef.current?.name ?? selected?.name ?? 'your destination';
    const eta = formatDuration(route.durationSeconds);
    const guide = prefs.name || 'your guide';
    const first = cleanInstruction(list[0]?.instruction ?? 'Follow the highlighted route.');
    const intro = spokenCopy(prefs.language).intro(guide, destName, eta, first);
    void (async () => {
      await setAssistantVoice(prefs.gender, prefs.language);
      await speak(intro);
    })();
  }

  useEffect(() => {
    if (!route.params?.autoStart || autoStarted.current || navigating || planning) return;
    if (!primary) return;
    autoStarted.current = true;
    void beginTrip();
  }, [route.params?.autoStart, primary, navigating, planning]);

  function stopNavigation() {
    if (navWatchId.current !== null) clearWatch(navWatchId.current);
    navWatchId.current = null;
    if (watchId.current !== null) clearWatch(watchId.current);
    watchId.current = null;
    setNavigating(false);
    setTabBarHidden(false);
    stopSpeaking();
  }

  useEffect(
    () => () => {
      setTabBarHidden(false);
      stopSpeaking();
      if (navWatchId.current !== null) clearWatch(navWatchId.current);
    },
    [],
  );

  function clearSelection() {
    setSelected(null);
    setRoutes([]);
    setStopPlaces([]);
    setEndSearching(true);
    setQuery('');
    setStepsOpen(false);
  }

  async function acquireLocation(prompt = true) {
    setFindingLocation(true);
    const result = await locateUser();
    setFindingLocation(false);
    if (result.ok) {
      setMe(result.position);
      setRegion(regionForRadius(result.position, searchRadiusM));
      setLocationIssue(null);
      mapRef.current?.animateToRegion(regionForRadius(result.position, searchRadiusM), 500);
      return true;
    }
    setLocationIssue(result.reason);
    if (prompt && result.reason === 'disabled') promptEnableGps();
    if (prompt && result.reason === 'denied') promptAllowLocation();
    return false;
  }

  function recenter() {
    const center = me ?? origin;
    if (center) {
      mapRef.current?.animateToRegion(regionForRadius(center, searchRadiusM), 500);
      return;
    }
    void acquireLocation(true);
  }

  function applySearchRadius(meters: number) {
    setSearchRadiusM(meters);
    const center = me ?? origin;
    if (center) {
      mapRef.current?.animateToRegion(regionForRadius(center, meters), 400);
    }
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
    origin: origin ?? undefined,
    radiusMeters: searchRadiusM,
    routeStyle: preference,
    mode,
    stops: stopPlaces.length ? stopPlaces.map((s) => s.name) : undefined,
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
            const here = me ?? origin;
            const found = await searchPlaces(action.query, here ?? undefined, 8);
            const match = here
              ? found
                  .map((p) => ({ p, d: haversine(here, p.center) }))
                  .filter(({ d }) => d <= searchRadiusM)
                  .sort((a, b) => a.d - b.d)[0]?.p
              : found[0];
            if (match) {
              if (selected) await addStop(match);
              else await planRoute(match);
              setAssistantOpen(false);
            } else {
              setBanner(`Nothing matching “${action.query}” inside ${formatDistance(searchRadiusM)}.`);
            }
          } catch {
            /* nothing found */
          }
        }
        break;
      case 'remove_stop':
        if (stopPlaces.length) {
          const next = stopPlaces.slice(0, -1);
          setStopPlaces(next);
          if (selected) await planRoute(selected, { stops: next });
        } else {
          clearSelection();
        }
        break;
      case 'set_route_style':
        changePreference(action.routeStyle === 'shortest' ? 'shortest' : 'fastest');
        break;
      case 'start_navigation':
        setAssistantOpen(false);
        void beginTrip();
        break;
      default:
        break;
    }
  }

  useEffect(() => () => void destroyVoice(), []);

  const routing = Boolean(selected && (routes.length > 0 || planning));
  const sheetMax = Math.round(Math.min(520, winH * 0.52));
  const chromeBottom = navigating ? insets.bottom + 12 : 88 + insets.bottom;
  const sheetLift = selected && !navigating ? (routing ? 268 : 248) : !selected && !navigating ? 92 : 0;

  const radiusPicker = (
    <View style={styles.radiusBlock}>
      <View style={styles.radiusHead}>
        <Txt variant="caption" color={colors.textFaint}>
          AI SEARCH RADIUS
        </Txt>
        <Txt variant="bodyStrong">{formatDistance(searchRadiusM)}</Txt>
      </View>
      <Txt variant="small" color={colors.textDim} style={{ marginBottom: spacing.sm }}>
        Famous places inside this circle are announced while you travel.
      </Txt>
      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS.map(([meters, label]) => {
          const on = searchRadiusM === meters;
          return (
            <Pressable
              key={meters}
              style={[styles.radiusChip, on && styles.radiusChipOn]}
              onPress={() => applySearchRadius(meters)}
            >
              <Txt variant="caption" color={on ? colors.onPrimary : colors.text}>
                {label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
  const fabBottom = chromeBottom + sheetLift + 12;


  if (!region) {
    const denied = locationIssue === 'denied';
    const gpsOff = locationIssue === 'disabled';
    return (
      <View style={styles.root}>
        <View style={[styles.gate, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.gateIcon}>
            <Icon.NavigationIcon color={colors.primary} size={28} />
          </View>
          <Txt variant="h2" style={{ textAlign: 'center' }}>
            {findingLocation
              ? 'Finding you…'
              : gpsOff
                ? 'Turn on location'
                : denied
                  ? 'Allow location'
                  : 'Couldn’t find you'}
          </Txt>
          <Txt variant="body" color={colors.textDim} style={{ textAlign: 'center' }}>
            {findingLocation
              ? 'Getting a quick location fix…'
              : gpsOff
                ? 'Location is off. Turn on GPS, then the map will open where you are.'
                : denied
                  ? 'Grant location permission first. The map will not open until you allow it.'
                  : 'Try again, or check that GPS is on and permission is allowed.'}
          </Txt>
          {findingLocation ? (
            <Loader label="Finding your location…" />
          ) : (
            <View style={styles.gateActions}>
              <Button
                title={gpsOff ? 'Turn on GPS' : 'Allow location'}
                loading={findingLocation}
                onPress={() => {
                  if (gpsOff) {
                    openLocationSettings();
                    return;
                  }
                  void acquireLocation(false);
                }}
              />
              {denied ? (
                <Button title="Open settings" variant="secondary" onPress={openAppSettings} />
              ) : gpsOff ? (
                <Button
                  title="I’ve turned GPS on"
                  variant="secondary"
                  onPress={() => void acquireLocation(false)}
                />
              ) : (
                <Button title="Try again" variant="secondary" onPress={() => void acquireLocation(false)} />
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={GOOGLE_MAPS_ENABLED ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={[StyleSheet.absoluteFill, styles.mapLayer]}
        initialRegion={region}
        mapType={mapType}
        showsTraffic={traffic}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterests
        showsBuildings
        toolbarEnabled={false}
        onPoiClick={(e) => {
          const { coordinate, name, placeId } = e.nativeEvent;
          chooseDestination({
            id: placeId || `poi:${coordinate.latitude},${coordinate.longitude}`,
            name: name || 'Selected place',
            address: name || '',
            center: coordinate,
          });
        }}
      >
        {saved.map((p) => {
          const dest: Place = {
            id: p.id,
            name: p.label === 'CUSTOM' ? p.name : p.label === 'HOME' ? 'Home' : 'Work',
            address: p.address,
            center: { latitude: p.latitude, longitude: p.longitude },
          };
          return (
            <Marker
              key={`saved-${p.id}`}
              identifier={`saved-${p.id}`}
              coordinate={dest.center}
              title={dest.name}
              description={p.address}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              onPress={() => chooseDestination(dest)}
            >
              <View pointerEvents="none" style={[styles.pin, { backgroundColor: colors.teal }]}>
                <Icon.BookmarkIcon color={colors.onPrimary} size={14} />
              </View>
            </Marker>
          );
        })}

        {results.map((p) => {
          const { Glyph, color } = categoryMeta(p.category);
          return (
            <Marker
              key={`res-${p.id}`}
              identifier={`res-${p.id}`}
              coordinate={p.center}
              title={p.name}
              description={p.address}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              onPress={() => chooseDestination(p)}
            >
              <View pointerEvents="none" style={[styles.pin, { backgroundColor: color }]}>
                <Glyph color={colors.onPrimary} size={14} />
              </View>
            </Marker>
          );
        })}

        {stopPlaces.map((s, i) => (
          <Marker key={`stop-${s.id}-${i}`} coordinate={s.center} title={`Stop ${i + 1}`}>
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

        {(me ?? origin) ? (
          <Circle
            center={(me ?? origin) as LatLng}
            radius={searchRadiusM}
            strokeColor="rgba(108,77,255,0.85)"
            fillColor="rgba(108,77,255,0.14)"
            strokeWidth={2}
          />
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

      <View pointerEvents="box-none" style={styles.overlayRoot}>
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
        ) : routing ? (
          <View style={[styles.searchWrap, { top: insets.top + spacing.sm }]}>
            <View style={styles.routeHead}>
              <Pressable
                hitSlop={8}
                style={styles.roundBtn}
                onPress={() => {
                  setRoutes([]);
                  setStepsOpen(false);
                }}
              >
                <Icon.BackIcon color={colors.text} size={20} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Pressable
                  style={styles.routeField}
                  onPress={() => {
                    setEditing('start');
                    setQuery('');
                    setResults([]);
                  }}
                >
                  <View style={styles.dotStart} />
                  {editing === 'start' ? (
                    <TextInput
                      placeholder="Your location"
                      placeholderTextColor={colors.textFaint}
                      value={query}
                      onChangeText={setQuery}
                      style={styles.tripInput}
                      autoFocus
                    />
                  ) : (
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {startPlace?.name ?? 'Your location'}
                    </Txt>
                  )}
                </Pressable>
                <Pressable
                  style={styles.routeField}
                  onPress={() => {
                    setEditing('end');
                    setEndSearching(true);
                    setQuery('');
                    setResults([]);
                  }}
                >
                  <View style={styles.dotEnd} />
                  {editing === 'end' && endSearching ? (
                    <TextInput
                      placeholder={selected?.name ?? 'Choose destination'}
                      placeholderTextColor={colors.textFaint}
                      value={query}
                      onChangeText={setQuery}
                      style={styles.tripInput}
                      autoFocus
                    />
                  ) : (
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {selected?.name ?? 'Choose destination'}
                    </Txt>
                  )}
                </Pressable>
              </View>
              <Pressable hitSlop={8} style={styles.roundBtn} onPress={swapTripEnds}>
                <Icon.SwapIcon color={colors.text} size={18} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeScroller}>
              {TRAVEL_MODES.map((m) => {
                const active = m === mode;
                const { label, icon: MIcon } = MODE_META[m];
                const eta = active && primary ? formatDuration(primary.durationSeconds) : null;
                return (
                  <Pressable
                    key={m}
                    style={[styles.modeChip, active && styles.modeChipOn]}
                    onPress={() => changeMode(m)}
                  >
                    <MIcon color={active ? colors.onPrimary : colors.textDim} size={18} />
                    <Txt variant="caption" color={active ? colors.onPrimary : colors.textDim}>
                      {eta ?? label}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
            {results.length && query.trim().length >= 2 ? (
              <View style={styles.results}>
                {results.slice(0, 5).map((p) => (
                  <Pressable key={p.id} style={styles.resultRow} onPress={() => pickSearchResult(p)}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {p.name}
                    </Txt>
                    <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                      {p.address}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.searchWrap, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
            <View style={styles.searchBar}>
              <Pressable hitSlop={8} onPress={() => navigation.navigate('Home')}>
                <Icon.MenuIcon color={colors.text} size={22} />
              </Pressable>
              <TextInput
                placeholder={browseQuery ? exploreTitle(browseQuery) : 'Search here'}
                placeholderTextColor={colors.textFaint}
                value={query}
                onChangeText={(t) => {
                  setBrowseQuery(null);
                  setEditing('end');
                  setEndSearching(true);
                  setQuery(t);
                }}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              <Pressable hitSlop={8} onPress={() => setAssistantOpen(true)}>
                <Icon.MicIcon color={colors.primary} size={22} />
              </Pressable>
              {selected ? (
                <Pressable hitSlop={8} onPress={() => clearSelection()}>
                  <Icon.CloseIcon color={colors.textDim} size={20} />
                </Pressable>
              ) : (
                <Pressable onPress={() => navigation.navigate('Profile')}>
                  <Avatar name={user?.name} size={34} />
                </Pressable>
              )}
            </View>
            {browseQuery && !query.trim() ? (
              <View style={styles.browseHint}>
                <Txt variant="small" color={colors.textDim}>
                  {results.length ? 'Tap a pin to preview that place' : 'Looking around you…'}
                </Txt>
              </View>
            ) : null}
            {banner ? (
              <View style={styles.searchBanner}>
                <Txt variant="small" color={colors.danger}>
                  {banner}
                </Txt>
              </View>
            ) : null}
            {results.length && query.trim().length >= 2 ? (
              <View style={styles.results}>
                {results.slice(0, 6).map((p) => {
                  const { Glyph, color } = categoryMeta(p.category);
                  return (
                    <Pressable key={p.id} style={styles.resultRow} onPress={() => pickSearchResult(p)}>
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
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}

        {!navigating && locationIssue && !findingLocation ? (
          <View style={[styles.gpsCard, { top: insets.top + 78 }]}>
            <View style={styles.gpsIcon}>
              <Icon.NavigationIcon color={colors.primary} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">
                {locationIssue === 'disabled'
                  ? 'Location is turned off'
                  : locationIssue === 'denied'
                    ? 'Location permission needed'
                    : 'Couldn’t find your location'}
              </Txt>
              <Txt variant="small" color={colors.textDim}>
                Allow GPS so routes start from where you are.
              </Txt>
            </View>
            <Pressable style={styles.gpsBtn} onPress={() => void acquireLocation(true)}>
              <Txt variant="caption" color={colors.onPrimary}>
                Enable
              </Txt>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.controls, { bottom: fabBottom + 64 }]}>
          <Pressable style={styles.ctrlBtn} onPress={cycleMapType}>
            <Icon.LayersIcon color={mapType === 'standard' ? colors.text : colors.primary} size={20} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, traffic && styles.ctrlBtnOn]} onPress={() => setTraffic((v) => !v)}>
            <Icon.TrafficIcon color={traffic ? colors.onPrimary : colors.text} size={20} />
          </Pressable>
        </View>

        <Pressable style={[styles.fab, { bottom: selected ? fabBottom : fabBottom + 66 }]} onPress={recenter}>
          <Icon.NavigationIcon color={colors.info} size={22} />
        </Pressable>

        {!navigating && !selected ? (
          <Pressable
            style={[styles.directionsFab, { bottom: fabBottom }]}
            onPress={() => {
              setEditing('end');
              setEndSearching(true);
              setAssistantOpen(false);
            }}
          >
            <Icon.NavigationIcon color={colors.onPrimary} size={24} />
          </Pressable>
        ) : null}

        {offRoute ? (
          <View style={[styles.reroute, { bottom: chromeBottom + 56 }]}>
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

        {suggestion ? (
          (() => {
            const { Glyph, color } = categoryMeta(suggestion.place.category ?? suggestion.category);
            return (
              <View style={[styles.suggestion, { bottom: chromeBottom + 56 }]}>
                <View style={[styles.suggestIcon, { backgroundColor: color }]}>
                  <Glyph color={colors.onPrimary} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {suggestion.place.name}
                  </Txt>
                  <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                    Famous place • {formatDistance(suggestion.meters)} — add a stop?
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

        {!navigating && !selected && !routing ? (
          <View style={[styles.radiusDock, { bottom: chromeBottom }]}>{radiusPicker}</View>
        ) : null}

        {selected && navigating ? (
          <View style={[styles.sheet, { bottom: chromeBottom }]}>
            <View style={styles.navControls}>
              <View style={styles.navStats}>
                <Txt variant="h3">{formatDuration(remaining.duration)}</Txt>
                <Txt variant="small" color={colors.textDim}>
                  {formatDistance(remaining.distance)} • {selected.name}
                </Txt>
                <Txt variant="caption" color={colors.primary}>
                  Voice guidance on
                </Txt>
              </View>
              <Button title="End" variant="danger" full={false} onPress={stopNavigation} style={{ minWidth: 110 }} />
            </View>
          </View>
        ) : null}

        {selected && !navigating && routing ? (
          <View style={[styles.sheet, { bottom: chromeBottom, maxHeight: sheetMax }]}>
            <View style={styles.handle} />
            <Txt variant="h3">
              {primary
                ? `${formatDuration(primary.durationSeconds)} (${formatDistance(primary.distanceMeters)})`
                : planning
                  ? 'Finding the best route…'
                  : selected.name}
            </Txt>
            <Txt variant="small" color={preference === 'fastest' ? colors.success : colors.textDim}>
              {preference === 'fastest' ? 'Fastest route' : 'Shortest route'}
              {stopPlaces.length ? ` • ${stopPlaces.length} stop${stopPlaces.length > 1 ? 's' : ''}` : ''}
            </Txt>
            {routes.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.altRow}>
                {routes.map((r, i) => {
                  const active = i === routeIndex;
                  return (
                    <Pressable key={r.id} style={[styles.altChip, active && styles.altChipOn]} onPress={() => setRouteIndex(i)}>
                      <Txt variant="bodyStrong" color={active ? colors.primary : colors.text}>
                        {formatDuration(r.durationSeconds)}
                      </Txt>
                      <Txt variant="caption" color={colors.textDim}>
                        {i === 0 ? 'Best' : formatDistance(r.distanceMeters)}
                      </Txt>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {stepsOpen ? (
              <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                {(primary?.legs[0]?.steps ?? []).slice(0, 8).map((s, i) => (
                  <Txt key={`${s.location.latitude}-${i}`} variant="small" color={colors.textDim} style={{ marginTop: 6 }}>
                    {i + 1}. {cleanInstruction(s.instruction)}
                  </Txt>
                ))}
              </ScrollView>
            ) : null}
            {radiusPicker}
            <View style={styles.sheetActions}>
              <Pressable style={styles.ghostBtn} onPress={() => setStepsOpen((v) => !v)}>
                <Icon.ListIcon color={colors.text} size={18} />
                <Txt variant="bodyStrong">{stepsOpen ? 'Hide' : 'Steps'}</Txt>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Button
                  title="Start"
                  left={<Icon.NavigationIcon color={colors.onPrimary} size={18} />}
                  loading={planning}
                  onPress={() => void beginTrip()}
                />
              </View>
            </View>
          </View>
        ) : null}

        {selected && !navigating && !routing ? (
          <View style={[styles.sheet, { bottom: chromeBottom }]}>
            <View style={styles.handle} />
            <Txt variant="h3" numberOfLines={2}>
              {selected.name}
            </Txt>
            <Txt variant="small" color={colors.textDim} numberOfLines={2}>
              {selected.address}
              {origin ? `  ·  ${formatDistance(haversine(origin, selected.center))}` : ''}
            </Txt>
            {radiusPicker}
            <View style={styles.placeActions}>
              <Pressable
                style={styles.primaryPill}
                onPress={() => selected && void planRoute(selected)}
              >
                <Icon.NavigationIcon color={colors.onPrimary} size={18} />
                <Txt variant="bodyStrong" color={colors.onPrimary}>
                  Directions
                </Txt>
              </Pressable>
              <Pressable style={styles.ghostPill} onPress={() => void sharePlace(selected)}>
                <Icon.ShareIcon color={colors.text} size={18} />
                <Txt variant="small">Share</Txt>
              </Pressable>
              <Pressable style={styles.ghostPill} onPress={() => void bookmarkPlace(selected)}>
                <Icon.BookmarkIcon color={colors.text} size={18} />
                <Txt variant="small">Save</Txt>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {assistantOpen ? (
        <AssistantSheet
          context={assistantContext}
          persona={{ name: prefs.name, language: prefs.language }}
          onClose={() => setAssistantOpen(false)}
          onAction={(a) => void onAssistantAction(a)}
          onSuggestStop={(item) => setSuggestion(item)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapLayer: { zIndex: 0, elevation: 0 },
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    elevation: 20,
  },
  gate: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  gateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  gateActions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

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

  searchWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 30, elevation: 24 },
  browseBar: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadow.lifted,
  },
  browseIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.lifted,
    elevation: 22,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  tripRowOn: { backgroundColor: colors.surfaceAlt },
  tripInput: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 0,
  },
  tripHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  addStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  radiusDock: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.lifted,
  },
  radiusBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  radiusHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  radiusRow: { flexDirection: 'row', gap: 6 },
  radiusChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  radiusChipOn: { backgroundColor: colors.primary },
  tripActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  talkBtn: { borderRadius: radius.md, overflow: 'hidden' },
  talkBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    height: 54,
    borderRadius: radius.md,
  },
  dotStart: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.teal },
  dotEnd: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent },
  dotStop: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBanner: {
    marginTop: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  gpsCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  gpsIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
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
    zIndex: 40,
    elevation: 24,
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
    zIndex: 40,
    elevation: 24,
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

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    ...shadow.lifted,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 6,
  },
  browseHint: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.soft,
  },
  routeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    ...shadow.lifted,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  routeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
    paddingHorizontal: 4,
  },
  modeScroller: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  modeChipOn: { backgroundColor: colors.info },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  placeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.info,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.pill,
  },
  ghostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  directionsFab: {
    position: 'absolute',
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 24,
    ...shadow.lifted,
  },
  altRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  altChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  altChipOn: { backgroundColor: colors.primarySoft },
});
