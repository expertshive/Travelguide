import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Guards the service-to-service credential endpoint.
 *
 * This is the one route that returns secrets in clear text, so it is not reached
 * with a user's access token — only with a shared secret that never leaves the
 * cluster. The gateway does not proxy `/v1/auth/internal/*`, so it is not
 * reachable from outside in the first place.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
      throw new ServiceUnavailableException('INTERNAL_SERVICE_TOKEN is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-internal-token'];
    const supplied = Array.isArray(header) ? header[0] : header;
    if (!supplied) throw new UnauthorizedException('Missing internal token');

    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    // timingSafeEqual throws on length mismatch, so compare lengths first.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}
