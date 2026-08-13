# Traveler Guide — Project Progress

## Where the project actually stands

Five things are built and working end to end: **authentication**, **user
profiles**, **the API Gateway**, **map-service**, and the **AI voice assistant**
(ai-service). On top of those, two platform-wide admin capabilities are live:
**managing every service's database tables** and **managing all third-party API
credentials** (encrypted at rest, with live connection tests). The remaining
scaffold microservices boot, expose a health check and a Swagger page, and now
also surface their tables to the admin — but still carry no business logic.

### Foundation — done

- Monorepo on pnpm workspaces + Turborepo
- Shared packages: `types`, `contracts`, `config`, `validation`, `logger`,
  `api-client`, `eslint-config`, `tsconfig`
- 14 NestJS apps (API Gateway + 13 microservices), one MySQL database each
- Prisma per service, Docker Compose for MySQL / Redis / RabbitMQ
- Swagger, health checks, shared exception filter and response interceptor
- ESLint + Prettier, root `dev` / `build` / `lint` / `test` / `type-check`
- Git repository initialised with a hardened `.gitignore`

### auth-service (:4001) — implemented

- OTP-based registration, login, refresh, logout
- Forgot password and reset password
- Roles and permissions, with admin endpoints for managing users and roles
- Everybody registering from the mobile app receives the `traveler` role.
  Assignment is strict: registration fails loudly if the role is missing rather
  than silently creating a user with no role.

### user-service (:4002) — implemented

- Profile CRUD: display name, bio, location, website
- Avatar and photo upload with static file serving
- Social links

### api-gateway (:4000) — implemented

- Proxies `/v1/<segment>` to each service
- **Verifies the JWT before proxying.** Anonymous calls to protected paths are
  rejected with 401 at the edge, so no downstream service has to decide whether
  an unauthenticated caller is allowed in. Only the auth endpoints needed to
  obtain a token are public.
- Forwards the verified caller as `x-user-id`, `x-user-email`, `x-user-roles`,
  and `x-user-permissions`, and strips any copy of those headers supplied by the
  client so an identity cannot be forged.
- Issues or preserves `x-correlation-id` on every proxied request
- WebSocket gateway is still a stub

### map-service (:4013) — implemented

The only service permitted to talk to a map provider. Full detail in
[NAVIGATION_FLOW.md](NAVIGATION_FLOW.md).

- Provider interfaces (`MapProvider`, `GeocodingProvider`, `RoutingProvider`,
  `NavigationProvider`, `TrafficProvider`) with **Google**, Mapbox, and offline
  adapters, selected by a registry that degrades on retryable failures. The
  Google adapter uses Places Text Search (search), Geocoding (reverse), and the
  Directions API (real road routes, turn-by-turn steps, traffic-aware duration);
  set `MAP_PROVIDER=google` + `GOOGLE_MAPS_API_KEY` to enable it. The key stays
  server-side — clients never receive it.
- Place search, reverse geocoding, saved Home/Work/custom places, recent searches
- Route calculation, alternatives, rerouting, and stop-impact estimation
- Redis caching with an in-process fallback, per-user rate limiting, and daily
  per-provider usage counters
- Runs with no Mapbox token at all, serving everything through the offline
  provider

### ai-service (:4010) — implemented

The in-car voice co-pilot's brain.

- **Conversational assistant** (`POST /v1/ai/assistant`): Google Gemini turns a
  spoken request plus trip context (destination, route style, stops, distance,
  weather) into a natural reply and exactly one structured action — `search`,
  `add_stop`, `remove_stop`, `set_route_style`, `start_navigation`, or `none`.
  Route-changing actions are flagged `requiresConfirmation` so the app always
  asks before altering the route. Speaks English and Arabic, with a selectable
  gender/name persona.
- Uses the rolling **`gemini-flash-latest`** alias on the v1beta endpoint;
  newly-billed keys reject older pinned models, so the alias avoids 404s.
- **Weather** is quoted from Open-Meteo (keyless), looked up for the destination.
- **Text-to-speech** (`POST /v1/ai/tts`): ElevenLabs `eleven_multilingual_v2`
  returns base64 MP3 for a natural voice; the app falls back to the device voice
  when no key is configured.
- All three provider keys (Gemini, ElevenLabs, and the keyless Open-Meteo) are
  read through `IntegrationResolver`, so they can be rotated from the admin
  without a restart.

### Frontends

- **Admin portal** (Vite + React, :3002) — Horizon UI on Tailwind. Login, forgot
  and reset password, dashboard, users, roles, profile. Self-registration was
  removed and access requires the `admin:access` permission, so a traveller
  account created in the mobile app cannot reach the portal.
- **Mobile** (React Native CLI) — a custom design system (own tokens/kit, no UI
  Kitten) with bottom-tab navigation: Home, **Map**, Saved, Profile. Auth,
  profile, and edit-profile screens. The Map tab uses **`react-native-maps` with
  the Google provider** (Apple Maps fallback when no key) for current location,
  place search, route line, and turn-by-turn navigation; search/routes come from
  map-service. The Google Maps client key is read from a git-ignored source
  (Android `local.properties`, iOS `Maps.xcconfig`) — never committed. "Remember
  me" stores credentials in the iOS Keychain / Android Keystore. The Map tab also
  carries the **AI voice co-pilot**: speech-to-text captures a request, ai-service
  replies, ElevenLabs speaks it back (selectable gender/name, English or Arabic),
  and route-changing suggestions are applied only after the user confirms.
- **Public website** (Next.js) — scaffold only.

### Still scaffolds

`trip-service`, `place-service`, `navigation-service`, `social-service`,
`chat-service`, `notification-service`, `media-service`, `payment-service`,
`business-service`.

`navigation-service` is intentionally left empty: map and routing work lives in
`map-service` instead.

### Not started

- Trip creation and lifecycle
- RabbitMQ event publishing (module is a stub everywhere; nothing is published)
- WebSocket live trip updates
- Social, chat, payments, media pipeline, push notifications
- E2E tests, CI/CD, Kubernetes manifests

## Admin portal: all services and third-party keys

Documented in full in [ADMIN_PORTAL.md](ADMIN_PORTAL.md).

- **Every service's tables are manageable.** `packages/db-admin` is mounted by all
  13 services at `/v1/<segment>/admin/db`, driven by Prisma's DMMF, so a model
  added to a schema appears in the admin with no per-table code. 27 tables are
  live today. The gateway aggregates them in one call at `GET /v1/admin/services`,
  and reports a service that did not answer as offline instead of failing the page.
- **The scaffold services gained a `PrismaService`** and now expose a
  `ServiceRecord` table; they still have no business logic.
- **Third-party credentials are managed at `/integrations`.** Six providers are in
  the catalog (Google Maps, Mapbox, Gemini, ElevenLabs, Open-Meteo, mobile Maps
  SDK). Secrets are AES-256-GCM encrypted at rest as `v1:iv:tag:ciphertext`, the
  API returns only a masked preview plus where the value came from, and each
  provider has a live connection test that makes a real call to the vendor.
- **Keys are resolved per request**, registry first and environment variable second,
  cached for 30s — so rotating a key in the admin takes effect without a restart.
  Verified end to end: planting an invalid Google key made map-service fall through
  to its offline provider within the cache window, and clearing it restored Google.
- **Two locks on the admin surface.** The gateway requires `admin:access` on any
  `/v1/*/admin/**` path and refuses to proxy `/v1/*/internal/**` at all; each
  service additionally verifies the token itself, since service ports are directly
  reachable in development.

## Service port map

| Service | Port | Database | State |
|---------|------|----------|-------|
| api-gateway | 4000 | — | Implemented |
| auth-service | 4001 | traveler_auth | Implemented |
| user-service | 4002 | traveler_user | Implemented |
| trip-service | 4003 | traveler_trip | Scaffold |
| place-service | 4004 | traveler_place | Scaffold |
| navigation-service | 4005 | traveler_navigation | Scaffold (superseded by map-service) |
| social-service | 4006 | traveler_social | Scaffold |
| chat-service | 4007 | traveler_chat | Scaffold |
| notification-service | 4008 | traveler_notification | Scaffold |
| media-service | 4009 | traveler_media | Scaffold |
| ai-service | 4010 | traveler_ai | Implemented |
| payment-service | 4011 | traveler_payment | Scaffold |
| business-service | 4012 | traveler_business | Scaffold |
| map-service | 4013 | traveler_map | Implemented |

## Test coverage

| Suite | Tests | Covers |
|---|---|---|
| map-service | 85 | Polyline decoding, geodesic maths and route snapping, Mapbox normalisation and error mapping, provider fallback, caching, rate limiting, off-route detection, saved places |
| auth-service | 27 | Integration secret encryption round-trip, tamper and rotated-key rejection, preview masking, registry-over-environment precedence, omit-vs-clear save semantics, readiness reporting |
| api-gateway | 15 | JWT enforcement at the edge, identity forwarding, header-spoofing rejection, correlation IDs, routing |
| mobile | 1 | Smoke test |

Other services run `--passWithNoTests`.

## Next steps

1. `trip-service`: Trip, TripRoute, TripStop, TripLocationSnapshot, TripEvent
   models and the DRAFT → PLANNED → ACTIVE → PAUSED → COMPLETED/CANCELLED
   lifecycle, with ownership checks
2. RabbitMQ event publishing for the trip lifecycle
3. WebSocket live trip updates on the gateway, authenticated with JWT
4. A real Mapbox token, plus the native Mapbox SDK install on iOS and Android
   (needs a secret `sk.*` download token with `DOWNLOADS:READ`)
