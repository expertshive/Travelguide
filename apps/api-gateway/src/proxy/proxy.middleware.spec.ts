import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ProxyMiddleware } from './proxy.middleware';

const SECRET = 'test-access-secret-at-least-32-characters';

const SERVICE_URLS: Record<string, string> = {
  JWT_ACCESS_SECRET: SECRET,
  AUTH_SERVICE_URL: 'http://auth:4001',
  MAP_SERVICE_URL: 'http://map:4013',
  TRIP_SERVICE_URL: 'http://trip:4003',
};

const config = (overrides: Record<string, string> = {}) => {
  const values = { ...SERVICE_URLS, ...overrides };
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing ${key}`);
      return value;
    },
  } as unknown as ConfigService;
};

const jwt = new JwtService({ secret: SECRET });

const signToken = (payload: Record<string, unknown>, expiresIn = '15m') =>
  jwt.sign(payload, { secret: SECRET, expiresIn });

const buildRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    originalUrl: '/v1/map/geocode/search?q=cafe',
    method: 'GET',
    headers: {},
    readableEnded: true,
    ...overrides,
  }) as unknown as Request;

const buildResponse = () => {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
    },
  };
  return res as unknown as Response & typeof res;
};

const upstreamOk = () =>
  ({
    status: 200,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(0),
  }) as unknown as Response;

/** Waits for the middleware's fire-and-forget forward to settle. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ProxyMiddleware', () => {
  let fetchMock: jest.SpyInstance;
  let middleware: ProxyMiddleware;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(upstreamOk() as never);
    middleware = new ProxyMiddleware(config(), jwt);
  });

  afterEach(() => jest.restoreAllMocks());

  const forwardedHeaders = () => (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;

  describe('routing', () => {
    it('sends map traffic to the map service', async () => {
      const req = buildRequest({
        headers: { authorization: `Bearer ${signToken({ sub: 'user-1' })}` },
      });
      middleware.use(req, buildResponse(), jest.fn());
      await flush();

      expect(fetchMock.mock.calls[0][0]).toBe('http://map:4013/v1/map/geocode/search?q=cafe');
    });

    it('passes unknown segments to the next handler instead of proxying', () => {
      const next = jest.fn();
      middleware.use(buildRequest({ originalUrl: '/v1/unknown/thing' }), buildResponse(), next);

      expect(next).toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('leaves the health check to the gateway itself', () => {
      const next = jest.fn();
      middleware.use(buildRequest({ originalUrl: '/v1/health' }), buildResponse(), next);

      expect(next).toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports a misconfigured upstream rather than proxying nowhere', async () => {
      const bare = new ProxyMiddleware(config({ MAP_SERVICE_URL: '' }), jwt);
      const res = buildResponse();
      bare.use(
        buildRequest({ headers: { authorization: `Bearer ${signToken({ sub: 'u' })}` } }),
        res,
        jest.fn(),
      );
      await flush();

      expect(res.statusCode).toBe(502);
    });
  });

  describe('authentication', () => {
    it('rejects a protected request with no token', () => {
      const res = buildResponse();
      middleware.use(buildRequest(), res, jest.fn());

      expect(res.statusCode).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a token signed with the wrong secret', () => {
      const forged = new JwtService({ secret: 'a-different-secret-entirely-1234567' }).sign(
        { sub: 'user-1' },
        { secret: 'a-different-secret-entirely-1234567' },
      );
      const res = buildResponse();
      middleware.use(buildRequest({ headers: { authorization: `Bearer ${forged}` } }), res, jest.fn());

      expect(res.statusCode).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an expired token', () => {
      const expired = signToken({ sub: 'user-1' }, '-1s');
      const res = buildResponse();
      middleware.use(buildRequest({ headers: { authorization: `Bearer ${expired}` } }), res, jest.fn());

      expect(res.statusCode).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed authorization header', () => {
      const res = buildResponse();
      middleware.use(buildRequest({ headers: { authorization: 'Token abc123' } }), res, jest.fn());

      expect(res.statusCode).toBe(401);
    });

    it('lets login through without a token', async () => {
      middleware.use(
        buildRequest({ originalUrl: '/v1/auth/login', method: 'POST' }),
        buildResponse(),
        jest.fn(),
      );
      await flush();

      expect(fetchMock.mock.calls[0][0]).toBe('http://auth:4001/v1/auth/login');
    });

    it('does not forward hop-by-hop headers that break Node fetch', async () => {
      middleware.use(
        buildRequest({
          originalUrl: '/v1/auth/login',
          method: 'POST',
          headers: {
            connection: 'keep-alive',
            'keep-alive': 'timeout=5',
            'transfer-encoding': 'chunked',
            host: '127.0.0.1:4000',
            'content-type': 'application/json',
          },
        }),
        buildResponse(),
        jest.fn(),
      );
      await flush();

      const headers = forwardedHeaders();
      expect(headers.has('connection')).toBe(false);
      expect(headers.has('keep-alive')).toBe(false);
      expect(headers.has('transfer-encoding')).toBe(false);
      expect(headers.has('host')).toBe(false);
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('still protects non-public auth endpoints', () => {
      const res = buildResponse();
      middleware.use(buildRequest({ originalUrl: '/v1/auth/me' }), res, jest.fn());

      expect(res.statusCode).toBe(401);
    });
  });

  describe('identity forwarding', () => {
    it('passes the verified user to the upstream service', async () => {
      const token = signToken({
        sub: 'user-42',
        email: 'traveler@example.com',
        roles: ['traveler'],
        permissions: ['trip:create'],
      });
      middleware.use(buildRequest({ headers: { authorization: `Bearer ${token}` } }), buildResponse(), jest.fn());
      await flush();

      const headers = forwardedHeaders();
      expect(headers.get('x-user-id')).toBe('user-42');
      expect(headers.get('x-user-email')).toBe('traveler@example.com');
      expect(headers.get('x-user-roles')).toBe('traveler');
      expect(headers.get('x-user-permissions')).toBe('trip:create');
    });

    it('discards identity headers supplied by the caller', async () => {
      const token = signToken({ sub: 'user-42' });
      middleware.use(
        buildRequest({
          headers: {
            authorization: `Bearer ${token}`,
            'x-user-id': 'admin-impersonated',
            'x-user-permissions': 'admin:access',
          },
        }),
        buildResponse(),
        jest.fn(),
      );
      await flush();

      const headers = forwardedHeaders();
      expect(headers.get('x-user-id')).toBe('user-42');
      expect(headers.get('x-user-permissions')).toBe('');
    });

    it('does not attach an identity to public requests', async () => {
      middleware.use(
        buildRequest({
          originalUrl: '/v1/auth/login',
          method: 'POST',
          headers: { 'x-user-id': 'sneaky' },
        }),
        buildResponse(),
        jest.fn(),
      );
      await flush();

      expect(forwardedHeaders().get('x-user-id')).toBeNull();
    });
  });

  describe('correlation id', () => {
    it('generates one when the caller does not supply it', async () => {
      const res = buildResponse();
      middleware.use(
        buildRequest({ headers: { authorization: `Bearer ${signToken({ sub: 'u' })}` } }),
        res,
        jest.fn(),
      );
      await flush();

      const generated = forwardedHeaders().get('x-correlation-id');
      expect(generated).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.headers['x-correlation-id']).toBe(generated);
    });

    it('preserves a correlation id the caller already set', async () => {
      middleware.use(
        buildRequest({
          headers: {
            authorization: `Bearer ${signToken({ sub: 'u' })}`,
            'x-correlation-id': 'trace-abc',
          },
        }),
        buildResponse(),
        jest.fn(),
      );
      await flush();

      expect(forwardedHeaders().get('x-correlation-id')).toBe('trace-abc');
    });
  });
});
