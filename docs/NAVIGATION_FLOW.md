# Navigation flow

How the app turns a place name into a route, and how it keeps that route correct
while somebody is driving.

## Why map-service is separate

`map-service` (`:4013`, database `traveler_map`) is the **only** service allowed
to call a map provider. Everything that needs geocoding or a route asks it.

That boundary buys three things:

- **One place holds the provider key.** No other service, and no client, ever
  sees the Mapbox secret token.
- **One place holds the quota.** Caching, rate limiting, and usage counters are
  applied once instead of being reimplemented per caller.
- **Swapping providers is a local change.** Callers depend on our own route and
  place shapes, not on Mapbox's response format.

## Request path

```
mobile app
    │  Authorization: Bearer <access token>
    ▼
api-gateway (:4000)
    │  verifies the JWT, rejects anonymous callers with 401
    │  adds x-user-id / x-user-email / x-user-roles / x-user-permissions
    │  adds x-correlation-id
    ▼
map-service (:4013)
    │  Redis cache → rate limit → provider chain
    ▼
Mapbox Geocoding / Directions   (falls back to the offline provider)
```

The gateway strips any `x-user-*` header that arrives from the client before
setting its own, so a caller cannot present a forged identity.

## Provider chain

`ProviderRegistry` holds providers in preference order and calls them in turn:

1. **Mapbox** — used when `MAPBOX_ACCESS_TOKEN` is set and `MAP_PROVIDER=mapbox`.
2. **Offline** — always last. Interpolates straight-line geometry and synthesises
   durations from average speeds per travel mode.

The offline provider exists so the backend, the test suite, and CI all work
without a token. **It does not follow roads**, so its distances are optimistic.
It is a development and failover convenience, not a substitute for a real
provider.

Failures are classified before the registry decides whether to retry:

| Code | Cause | Retry with next provider? |
|---|---|---|
| `PROVIDER_TIMEOUT` | Provider exceeded `MAPBOX_TIMEOUT_MS` | Yes |
| `PROVIDER_RATE_LIMITED` | HTTP 429, or our own per-user limit | Yes |
| `PROVIDER_UNAVAILABLE` | 5xx, rejected token, network failure | Yes |
| `NO_ROUTE_FOUND` | No path between the points | No |
| `INVALID_LOCATION` | Coordinates out of range | No |

The last two are not retried because a second provider would reach the same
conclusion.

Five interfaces describe what a provider can do, and a new provider only has to
implement the ones it supports: `MapProvider` (style and tiles),
`GeocodingProvider`, `RoutingProvider`, `NavigationProvider` (snapping a position
to a route), and `TrafficProvider`.

## Endpoints

All are mounted under the gateway at `/v1/map` and require a valid access token.

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/map/geocode/config` | Style URL and **public** token for the client renderer |
| GET | `/v1/map/geocode/search` | Address autocomplete and place search |
| GET | `/v1/map/geocode/reverse` | Coordinates → address, used for dropped pins |
| GET | `/v1/map/geocode/recent` | Recent searches for the caller |
| DELETE | `/v1/map/geocode/recent` | Clear recent searches |
| GET | `/v1/map/geocode/places` | Saved places (Home, Work, custom) |
| POST | `/v1/map/geocode/places` | Save a place |
| DELETE | `/v1/map/geocode/places/:id` | Remove a saved place |
| POST | `/v1/map/routes/calculate` | One route between two points |
| POST | `/v1/map/routes/alternatives` | Route plus alternatives |
| POST | `/v1/map/routes/reroute` | Recalculate from the traveller's position |
| POST | `/v1/map/routes/estimate-stop-impact` | Added time and distance for a candidate stop |

Travel modes are `driving`, `motorcycle`, `walking`, and `cycling`. Mapbox has no
motorcycle profile, so motorcycle maps onto the plain driving profile.

Route options are `preference` (`fastest` or `shortest`) and `avoid` (`tolls`,
`highways`, `ferries`, `unpaved`). Mapbox has no exclusion for unpaved roads, so
that flag currently affects only our own preference ordering.

## Off-route detection and rerouting

Rerouting is the easiest way to burn through a provider quota, because a phone
emits a location update every second and GPS drifts even when the car is
perfectly on the road. Three guards prevent that:

1. **A distance threshold.** `POST /v1/map/routes/reroute` snaps the reported
   position onto the active route's geometry. Within
   `OFF_ROUTE_THRESHOLD_METERS` (default 50 m) it returns
   `{ rerouted: false }` *without calling any provider*. 50 m absorbs GPS drift
   and multi-lane roads.
2. **A cooldown.** Once a reroute happens, further reroutes for the same user are
   suppressed for `REROUTE_COOLDOWN_SECONDS` (default 15 s) and the previous
   route is returned instead.
3. **A per-user rate limit.** `MAP_RATE_LIMIT_PER_MINUTE` (default 60) caps
   geocoding and routing calls per user per minute, returning
   `PROVIDER_RATE_LIMITED`.

When the traveller really has left the route, the recalculation starts from their
**current position** rather than the original origin.

## Caching

Redis, with an in-process fallback so the service still runs when Redis is down.
The fallback is per-process and is not a substitute for Redis in a real
deployment.

| Data | TTL | Key detail |
|---|---|---|
| Place search | 6 hours | Query, proximity rounded to ~100 m, limit |
| Reverse geocode | 24 hours | Coordinates rounded to 5 decimal places |
| Routes | 5 minutes | Endpoints rounded to ~11 m, plus mode, preference, and avoid flags |

Rounding coordinates in the cache key is what makes the cache useful: two
requests from the same street corner produce the same key despite differing in
the sixth decimal place. Routes expire quickly because traffic changes.

Every call is counted per provider and per operation in `provider_usage`, split
into requests, errors, and cache hits. Counter writes are fire-and-forget so
usage accounting can never fail a user-facing request.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `MAP_PROVIDER` | `mapbox` | Preferred provider |
| `MAPBOX_ACCESS_TOKEN` | — | Server token. Never sent to clients |
| `MAPBOX_PUBLIC_TOKEN` | — | `pk.*` token returned to the renderer |
| `MAPBOX_STYLE_URL` | streets-v12 | Style for the client |
| `MAPBOX_TIMEOUT_MS` | `8000` | Per-request timeout |
| `MAP_RATE_LIMIT_PER_MINUTE` | `60` | Geocoding and routing calls per user |
| `OFF_ROUTE_THRESHOLD_METERS` | `50` | Distance before a reroute is considered |
| `REROUTE_COOLDOWN_SECONDS` | `15` | Minimum gap between reroutes |

Leaving `MAPBOX_ACCESS_TOKEN` empty is a supported configuration: the service
starts and serves every endpoint through the offline provider.
