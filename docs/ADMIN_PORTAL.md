# Admin portal: service data and third-party credentials

Two capabilities are described here: browsing and editing every service's tables,
and managing the credentials for every third-party API the system calls.

## 1. Every service's data

### The problem this solves

Thirteen services each own their own MySQL database. Writing a CRUD screen per
table would mean roughly thirty screens that all go stale the moment somebody
edits a `schema.prisma`.

### How it works

`packages/db-admin` is a Nest dynamic module that reads **Prisma's DMMF** — the
machine-readable description of a schema that the generated client already
carries. Table names, columns, types, primary keys and relations all come from
there, so a model added to a schema appears in the admin with no new code.

A service mounts it in one place:

```ts
// apps/trip-service/src/admin/db-admin.module.ts
DbAdminModule.forRoot({
  segment: 'trips',            // -> /v1/trips/admin/db/...
  label: 'Trips',              // sidebar group name
  models: Prisma.dmmf.datamodel.models,
  prisma: PrismaService,
})
```

`@Controller()` takes a literal path, so the controller class is generated per
service by `createDbAdminController` with the segment baked in, rather than the
same file being written out thirteen times.

Routes, all requiring `admin:access`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/<segment>/admin/db/tables` | every table with column metadata and row counts |
| `GET` | `/v1/<segment>/admin/db/tables/:model` | a page of rows, with search |
| `POST` | `/v1/<segment>/admin/db/tables/:model` | create a row |
| `PATCH` | `/v1/<segment>/admin/db/tables/:model` | update a row by primary key |
| `DELETE` | `/v1/<segment>/admin/db/tables/:model` | delete a row by primary key |

The admin portal does not call these thirteen times to build its sidebar. The
gateway fans out once at `GET /v1/admin/services` and returns each service with
its tables, marking any that did not answer as `online: false` so one service
being down greys out one group instead of failing the page.

### What the generic editor will not do

- **Sensitive columns are masked.** Any column matching
  `password|token|secret|otp|apikey` is returned as `••••••` and is not editable,
  so a password hash cannot be read or overwritten through the browser.
- **Computed columns are read-only.** IDs, `createdAt` and `@updatedAt` columns,
  and relation foreign keys are shown but not editable.
- **A table is only creatable if it can be.** `creatable` is false when a required
  column with no default is not editable — otherwise the form would offer to
  create a row the database is bound to reject.
- **Delete guards.** A service can register `DeleteGuard`s for rows whose removal
  would break the system. auth-service registers two: an admin cannot delete
  their own account, and the `super_admin` role is protected.

### Two locks, not one

The gateway rejects any request to `/v1/*/admin/**` without `admin:access`, so a
new service cannot publish its database by forgetting to guard itself. Each
service *also* verifies the token itself through `DbAdminGuard`, because in local
development the service ports are reachable directly. The guard pins the JWT
algorithm to HS256, so a token signed with `alg: none` is not accepted.

That second lock is also why the ten scaffold services need no auth wiring of
their own — they have none, and the module brings its own.

## 2. Third-party credentials

### The problem this solves

Keys were spread across `.env` files: the Google Maps key in
`apps/map-service/.env`, the Gemini key in `apps/ai-service/.env`, mobile keys in
`Maps.xcconfig` and `local.properties`. Rotating one meant finding the right file
and restarting the right process, and there was nowhere to see what was
configured or whether it still worked.

### The catalog

`packages/integrations/src/catalog.ts` is the single source of truth. The admin
page, the storage layer and the status endpoint are all driven off it, so
exposing a new provider means adding an entry there and nothing else.

| Provider | Vendor | Used by | Scope |
| --- | --- | --- | --- |
| `google_maps` | Google Maps Platform | map-service | server |
| `mapbox` | Mapbox | map-service | server |
| `gemini` | Google Gemini | ai-service | server |
| `open_meteo` | Open-Meteo (keyless) | ai-service | server |
| `google_maps_mobile` | Google Maps SDK | mobile | client build |

`scope` matters. A `server` value is read at request time, so saving it takes
effect within the resolver's cache window. A `clientBuild` value is compiled into
the mobile binary, so saving it records the value but the app must be rebuilt —
the admin says so rather than implying the save is live.

### Storage

Secrets are encrypted with **AES-256-GCM** under `SETTINGS_ENCRYPTION_KEY` and
stored as `v1:iv:tag:ciphertext`. A fresh IV per write means two identical keys do
not produce identical ciphertext. GCM's auth tag means a tampered row fails to
decrypt rather than returning something wrong.

`SETTINGS_ENCRYPTION_KEY` is either 64 hex characters used as 32 raw bytes, or a
passphrase of at least 16 characters stretched with scrypt.

```
openssl rand -hex 32
```

Losing that key does not brick anything: a row that cannot be decrypted is
reported as *not configured*, and the integration falls back to its environment
variable.

### Resolution order

A consuming service reads a credential through `IntegrationResolver`:

1. the registry in auth-service, cached for `INTEGRATION_CACHE_TTL_MS` (default 30s)
2. otherwise `process.env[KEY]`

The environment fallback is deliberate. It keeps a service working when
auth-service is unreachable, and it means a fresh checkout runs before anything
has been typed into the admin. When a fetch fails the resolver keeps serving the
last values it saw rather than dropping to environment-only mid-flight.

`peek()` exists because provider selection is synchronous — `ProviderRegistry`
has to decide whether Google is usable before it can route a request, so it reads
the last-known value rather than awaiting a fetch. `prime()` warms that cache at
startup.

### The internal endpoint

`GET /v1/auth/internal/integrations/:provider` returns credentials in clear text.
It is the one route that does, so:

- it is authenticated by `INTERNAL_SERVICE_TOKEN`, compared with
  `timingSafeEqual`, not by a user's access token
- the gateway **refuses to proxy `/v1/*/internal/**` at all**, answering 404
- it is excluded from the published API docs

### Admin routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/auth/admin/integrations` | catalog with configuration status |
| `PUT` | `/v1/auth/admin/integrations/:provider` | set or clear fields |
| `PATCH` | `/v1/auth/admin/integrations/:provider` | enable or disable |
| `DELETE` | `/v1/auth/admin/integrations/:provider` | clear stored credentials |
| `POST` | `/v1/auth/admin/integrations/:provider/test` | live connection test |

Save semantics matter, because the form shows masked secrets:

- **field omitted** — left unchanged, so saving a form full of masks is safe
- **field set to `""`** — stored value deleted, falling back to the environment
- **field set to a value** — encrypted and stored

### Testing a key means actually calling the provider

`POST .../test` makes a real request, so the admin sees the truth rather than
whether a string is non-empty. The probes distinguish failure modes that look
alike but need different fixes:

- Google answers HTTP 200 with a `status` field, so the body decides.
  `ZERO_RESULTS` still proves the key works; `REQUEST_DENIED` usually means the
  specific API is not enabled on the key.
- Gemini's `RESOURCE_EXHAUSTED` is reported as *valid key, no quota*, which is a
  billing problem, not a credential problem. A 404 means the model name is wrong
  for that key — worth knowing, since `gemini-2.0-flash` and
  `gemini-flash-latest` do not have the same availability.

### Security notes

- The API never returns a stored secret. Responses carry a `preview`
  (`AIzaSy…6Hk`) and a `source` (`database`, `environment` or `missing`).
  Values of twelve characters or fewer are withheld entirely, since revealing
  most of a short secret defeats the point.
- **Do not reuse a server key in the mobile app.** Keys compiled into a binary
  can be extracted, so a shared key lets anyone spend this project's quota.
  Restrict the server key by IP, and the mobile keys by bundle ID and package
  name plus signing certificate.
- `.env`, `Maps.xcconfig`, `local.properties` and `gradle.properties` are all
  git-ignored. Verify with `git check-ignore -v <path>` before committing.

## Local setup

```bash
# in .env
SETTINGS_ENCRYPTION_KEY=$(openssl rand -hex 32)
INTERNAL_SERVICE_TOKEN=$(openssl rand -hex 32)
INTEGRATION_CACHE_TTL_MS=30000
```

Then `./scripts/start-all.sh` and open <http://localhost:3002/integrations>.

Keys already in `.env` show up as `source: environment` and keep working. Move one
into the registry by typing it into the admin and saving; its source becomes
`database`, and clearing it hands control back to `.env`.
