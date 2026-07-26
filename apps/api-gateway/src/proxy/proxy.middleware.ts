import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

const SERVICE_ROUTES = [
  { segment: 'auth', envKey: 'AUTH_SERVICE_URL' },
  { segment: 'users', envKey: 'USER_SERVICE_URL' },
  { segment: 'trips', envKey: 'TRIP_SERVICE_URL' },
  { segment: 'places', envKey: 'PLACE_SERVICE_URL' },
  { segment: 'navigation', envKey: 'NAVIGATION_SERVICE_URL' },
  { segment: 'social', envKey: 'SOCIAL_SERVICE_URL' },
  { segment: 'chat', envKey: 'CHAT_SERVICE_URL' },
  { segment: 'notifications', envKey: 'NOTIFICATION_SERVICE_URL' },
  { segment: 'media', envKey: 'MEDIA_SERVICE_URL' },
  { segment: 'ai', envKey: 'AI_SERVICE_URL' },
  { segment: 'payments', envKey: 'PAYMENT_SERVICE_URL' },
  { segment: 'business', envKey: 'BUSINESS_SERVICE_URL' },
] as const;

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
  constructor(private readonly config: ConfigService) {}

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

    void this.forward(route.envKey, req, res);
  }

  private async forward(envKey: string, req: Request, res: Response) {
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
      res.status(502).json({
        success: false,
        error: { message: 'Upstream request failed', detail: String(error) },
      });
    }
  }
}
