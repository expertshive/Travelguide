# map-service

Maps, geocoding, and routing. Port `4013`, database `traveler_map`.

This is the **only** service allowed to call a map provider. Anything that needs
a place lookup or a route asks this service, which keeps provider keys, caching,
and quota in one place. See [../../docs/NAVIGATION_FLOW.md](../../docs/NAVIGATION_FLOW.md)
for the full design.

## Running it

```bash
cp .env.example .env          # JWT_ACCESS_SECRET must match auth-service
pnpm prisma:generate
pnpm prisma:push
pnpm dev
```

**No Mapbox token is required.** Without `MAPBOX_ACCESS_TOKEN` the service falls
back to a built-in offline provider so the backend and tests run without network
access or credentials. That provider interpolates straight lines between points,
so its routes do not follow roads — it is for development and failover, not
production.

To use Mapbox, set `MAPBOX_ACCESS_TOKEN` (server-side, never sent to clients) and
`MAPBOX_PUBLIC_TOKEN` (the `pk.*` token handed to the map renderer).

## Endpoints

Reached through the gateway at `/v1/map/...`, or directly on `:4013`. All require
a bearer token; Swagger is at `/docs`.

- `GET  /v1/map/geocode/config` — style URL and public token for the renderer
- `GET  /v1/map/geocode/search` — autocomplete and place search
- `GET  /v1/map/geocode/reverse` — coordinates to address
- `GET|DELETE /v1/map/geocode/recent` — recent searches
- `GET|POST /v1/map/geocode/places`, `DELETE /v1/map/geocode/places/:id` — Home, Work, custom
- `POST /v1/map/routes/calculate` — a route
- `POST /v1/map/routes/alternatives` — a route plus alternatives
- `POST /v1/map/routes/reroute` — recalculate from the traveller's position
- `POST /v1/map/routes/estimate-stop-impact` — cost of adding a stop

## Adding a provider

Implement the interfaces in `src/providers/types.ts` that your provider supports,
then add the instance to `ProviderRegistry.chain()`. Callers depend on our own
`Place` and `Route` shapes, so nothing else changes.

Translate provider faults into `ProviderError` with the right code — the registry
uses `isRetryable` to decide whether to fall through to the next provider.

## Tests

```bash
pnpm test
```

Tests never reach the network and never require Redis or MySQL. They use
`mockConfig()` from `src/testing/config.mock.ts` rather than the real
`ConfigService`, because the real one falls back to `process.env` and would
otherwise pick up a developer's local `REDIS_URL` or Mapbox token and behave
differently from CI.
