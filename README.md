# Traveler Guide

Production-ready monorepo for the **Traveler Guide** travel platform.

## Stack

| Layer | Technology |
|-------|------------|
| Admin Portal | React + Vite + TypeScript |
| Public Website | Next.js App Router + TypeScript |
| Mobile App | React Native CLI (iOS & Android) |
| Backend | NestJS microservices |
| API Gateway | NestJS (port 4000) |
| Database | MySQL 8 + Prisma (one DB per service) |
| Messaging | RabbitMQ |
| Cache | Redis |
| Real-time | WebSockets (API Gateway) |
| Monorepo | pnpm workspaces + Turborepo |
| Infrastructure | Docker Compose |

## Project structure

```
apps/
├── admin/                 # Admin portal (Vite, :3002)
├── web/                   # Public website (Next.js, :3000)
├── mobile/                # React Native CLI
├── api-gateway/           # REST gateway + WebSockets (:4000)
├── auth-service/          # JWT, roles, permissions (:4001)
├── user-service/          # (:4002)
├── trip-service/          # (:4003)
├── place-service/         # (:4004)
├── navigation-service/    # (:4005)
├── social-service/        # (:4006)
├── chat-service/          # (:4007)
├── notification-service/  # (:4008)
├── media-service/         # (:4009)
├── ai-service/            # (:4010)
├── payment-service/       # (:4011)
├── business-service/      # (:4012)
└── map-service/           # Maps, geocoding, routing (:4013)

packages/
├── config/                # Environment validation (Zod)
├── types/                 # Shared TypeScript types
├── contracts/             # RabbitMQ events & routing keys
├── api-client/            # HTTP client wrapper
├── db-admin/              # Schema-driven table admin, mounted by every service
├── integrations/          # Third-party credential registry, catalog & probes
├── validation/            # Zod schemas
├── logger/                # Structured JSON logger
├── eslint-config/         # Shared ESLint config
└── tsconfig/              # Shared TS configs

infrastructure/docker/     # MySQL, Redis, RabbitMQ
docs/                      # Project documentation
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose
- Xcode (iOS) / Android Studio (Android) for mobile

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env

# 3. Start infrastructure
pnpm dev:infra

# 4. Generate Prisma clients & push schemas
pnpm --filter @traveler-guide/auth-service prisma:generate
pnpm --filter @traveler-guide/auth-service prisma:push
# Repeat prisma:generate + prisma:push for other services as needed

# 5. Start all apps (parallel)
pnpm dev
```

## Root commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm dev:infra` | Start MySQL, Redis, RabbitMQ |
| `pnpm dev:down` | Stop Docker infrastructure |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages and apps |
| `pnpm type-check` | TypeScript check across monorepo |
| `pnpm test` | Run tests |
| `pnpm format` | Format with Prettier |

## Service URLs (development)

| Service | URL |
|---------|-----|
| Public Website | http://localhost:3000 |
| Admin Portal | http://localhost:3002 |
| API Gateway | http://localhost:4000 |
| Swagger (Gateway) | http://localhost:4000/docs |
| Auth Service | http://localhost:4001/docs |
| Map Service | http://localhost:4013/docs |
| RabbitMQ Management | http://localhost:15672 |
| Mobile Metro | http://localhost:8081 |

## Architecture rules

1. Each microservice owns its **own MySQL database** — no cross-service DB access.
2. Services communicate via **REST** (through API Gateway) and **RabbitMQ** events.
3. **JWT authentication** with roles and permissions handled by auth-service. The
   API Gateway verifies the token before proxying and forwards the caller's
   identity as `x-user-*` headers, so downstream services never parse tokens.
4. **Redis** for caching; **WebSockets** on API Gateway for real-time features.
5. **map-service is the only service that talks to a map provider.** Everything
   else asks it for geocoding and routes, so provider keys and quota live in one
   place. See [docs/NAVIGATION_FLOW.md](docs/NAVIGATION_FLOW.md).
6. **Every service exposes its tables the same way.** Each mounts
   `@traveler-guide/db-admin` at `/<segment>/admin/db`, which reads Prisma's DMMF,
   so a model added to a `schema.prisma` shows up in the admin portal with no
   per-table code. The gateway aggregates them at `GET /v1/admin/services`.
7. **Third-party credentials are managed, not just deployed.** Keys live in the
   registry described in [docs/ADMIN_PORTAL.md](docs/ADMIN_PORTAL.md), encrypted at
   rest, editable at `/integrations` in the admin, with the environment variable
   as the fallback. Anything under `/v1/*/admin/**` requires `admin:access`, and
   the gateway refuses to proxy `/v1/*/internal/**` at all.

## License

Private — Traveler Guide
