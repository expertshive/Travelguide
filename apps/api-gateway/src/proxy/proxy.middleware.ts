import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createLogger } from '@traveler-guide/logger';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { SERVICE_ROUTES } from './service-routes';

/**
 * Paths reachable without a token. Everything else is rejected here rather
 * than being forwarded, so a downstream service is never asked to decide
 * whether an anonymous caller is allowed in.
 */
const PUBLIC_PATHS = new Set([
  '/v1/auth/register/send-otp',
  '/v1/auth/register/verify-otp',
  '/v1/auth/login',
  '/v1/auth/refresh',
  '/v1/auth/forgot-password',
  '/v1/auth/reset-password',
]);

/**
 * Identity headers are minted here from a verified token. Any copy arriving
 * from the client is discarded first — otherwise a caller could simply set
 * `x-user-id` and impersonate somebody.
 */
const IDENTITY_HEADERS = [
  'x-user-id',
  'x-user-email',
  'x-user-roles',
  'x-user-permissions',
] as const;

const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Administrative surfaces — the generic table editors each service exposes at
 * `/v1/<segment>/admin/...`. Every service also guards these itself, but gating
 * them here means a new service cannot accidentally publish its database by
 * forgetting to.
 */
const ADMIN_PATH = /^\/v1\/[^/]+\/admin(\/|$)/;
const ADMIN_PERMISSION = 'admin:access';

/**
 * Service-to-service routes. These are reached directly over the internal
 * network with a shared token, and some of them return credentials in clear
 * text, so the gateway refuses to relay them from the outside world at all.
 */
const INTERNAL_PATH = /^\/v1\/[^/]+\/internal(\/|$)/;

type AccessTokenPayload = {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
};

function readRawBody(req: Request): Promise<Buffer> {
  if (req.readableEnded) {
    return Promise.resolve(Buffer.alloc(0));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = createLogger('ProxyMiddleware');

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const pathname = req.originalUrl.split('?')[0] ?? '';
    const segment = pathname.replace(/^\/v1\/?/, '').split('/').filter(Boolean)[0];
    if (!segment || segment === 'health') {
      next();
      return;
    }

    const route = SERVICE_ROUTES.find((r) => r.segment === segment);
    if (!route) {
      next();
      return;
    }

    const correlationId = this.correlationId(req);
    res.setHeader(CORRELATION_HEADER, correlationId);

    if (INTERNAL_PATH.test(pathname)) {
      this.logger.warn('Blocked an external request to an internal path', {
        correlationId,
        pathname,
      });
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });
      return;
    }

    // Never trust identity headers supplied by the caller.
    for (const header of IDENTITY_HEADERS) delete req.headers[header];

    let user: AccessTokenPayload | null = null;
    if (!PUBLIC_PATHS.has(pathname)) {
      user = this.verify(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid access token' },
        });
        return;
      }

      if (ADMIN_PATH.test(pathname) && !(user.permissions ?? []).includes(ADMIN_PERMISSION)) {
        this.logger.warn('Rejected non-admin request to an admin path', {
          correlationId,
          pathname,
          userId: user.sub,
        });
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Requires the ${ADMIN_PERMISSION} permission` },
        });
        return;
      }
    }

    void this.forward(route.envKey, req, res, user, correlationId);
  }

  private correlationId(req: Request): string {
    const existing = req.headers[CORRELATION_HEADER];
    const value = Array.isArray(existing) ? existing[0] : existing;
    return value && value.trim() ? value : randomUUID();
  }

  private verify(req: Request): AccessTokenPayload | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;

    try {
      return this.jwt.verify<AccessTokenPayload>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      // Covers expired, tampered, and wrongly signed tokens alike.
      return null;
    }
  }

  private async forward(
    envKey: string,
    req: Request,
    res: Response,
    user: AccessTokenPayload | null,
    correlationId: string,
  ) {
    const baseUrl = this.config.get<string>(envKey)?.replace(/\/$/, '');
    if (!baseUrl) {
      res.status(502).json({ success: false, error: { message: `${envKey} not configured` } });
      return;
    }

    const targetUrl = `${baseUrl}${req.originalUrl}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      // content-length is dropped because the forwarded body is re-encoded below.
      if (value === undefined || key === 'host' || key === 'content-length') continue;
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }

    headers.set(CORRELATION_HEADER, correlationId);
    if (user) {
      headers.set('x-user-id', user.sub);
      if (user.email) headers.set('x-user-email', user.email);
      headers.set('x-user-roles', (user.roles ?? []).join(','));
      headers.set('x-user-permissions', (user.permissions ?? []).join(','));
    }

    const init: RequestInit = {
      method: req.method,
      headers,
      redirect: 'manual',
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers['content-type'] ?? '';

      if (contentType.includes('application/json') && req.body !== undefined) {
        init.body = JSON.stringify(req.body);
        if (!headers.has('content-type')) {
          headers.set('content-type', 'application/json');
        }
      } else {
        // Multipart and other unparsed bodies must be forwarded byte-for-byte,
        // otherwise the upstream multipart boundary no longer matches the payload.
        const raw = await readRawBody(req);
        if (raw.length > 0) {
          init.body = raw;
        }
      }
    }

    try {
      const upstream = await fetch(targetUrl, init);
      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        // fetch already decoded the payload, so the upstream framing headers no
        // longer describe what we are about to write.
        const name = key.toLowerCase();
        if (name === 'transfer-encoding' || name === 'content-encoding' || name === 'content-length') {
          return;
        }
        res.setHeader(key, value);
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.send(body);
    } catch (error) {
      this.logger.error('Upstream request failed', {
        correlationId,
        target: envKey,
        message: error instanceof Error ? error.message : String(error),
      });
      res.status(502).json({
        success: false,
        error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Upstream request failed' },
      });
    }
  }
}
