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
└── business-service/      # (:4012)

packages/
├── config/                # Environment validation (Zod)
├── types/                 # Shared TypeScript types
├── contracts/             # RabbitMQ events & routing keys
├── api-client/            # HTTP client wrapper
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
| RabbitMQ Management | http://localhost:15672 |
| Mobile Metro | http://localhost:8081 |

## Architecture rules

1. Each microservice owns its **own MySQL database** — no cross-service DB access.
2. Services communicate via **REST** (through API Gateway) and **RabbitMQ** events.
3. **JWT authentication** with roles and permissions handled by auth-service.
4. **Redis** for caching; **WebSockets** on API Gateway for real-time features.

## License

Private — Traveler Guide
