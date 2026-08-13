import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
} from '@nestjs/common';
import { Permission } from '@traveler-guide/types';
import { verify } from 'jsonwebtoken';
import type { Request } from 'express';

type AccessTokenPayload = {
  sub?: string;
  email?: string;
  permissions?: unknown;
};

export interface DbAdminActor {
  userId: string;
  email?: string;
}

/** Where the verified actor is parked for `@DbAdminUser()` to pick up. */
const ACTOR_KEY = '__dbAdminActor';

/**
 * Verifies the access token and requires `admin:access`, independently of any
 * auth wiring the host service may or may not have — most scaffold services
 * have none at all.
 *
 * The gateway already blocks unauthenticated and non-admin callers, so this is
 * the second of two locks: it keeps the table editor shut even if a service
 * port is reached directly, which is the normal case in local development.
 */
@Injectable()
export class DbAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }

    // Read at request time: ConfigModule.forRoot has populated process.env by
    // now, and this avoids depending on ConfigService being available here.
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT_ACCESS_SECRET is not configured');
    }

    let payload: AccessTokenPayload;
    try {
      // Pinning the algorithm stops a token signed with `alg: none` — or with
      // the public half of an asymmetric pair — from being accepted.
      payload = verify(header.slice(7), secret, {
        algorithms: ['HS256'],
      }) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Access token has no subject');
    }

    const permissions = Array.isArray(payload.permissions)
      ? payload.permissions.map(String)
      : [];
    if (!permissions.includes(Permission.ADMIN_ACCESS)) {
      throw new ForbiddenException('Requires the admin:access permission');
    }

    const actor: DbAdminActor = { userId: payload.sub, email: payload.email };
    (request as Request & Record<string, unknown>)[ACTOR_KEY] = actor;
    return true;
  }
}

/** The admin making the request, as verified by {@link DbAdminGuard}. */
export const DbAdminUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): DbAdminActor => {
    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>();
    return (request[ACTOR_KEY] as DbAdminActor | undefined) ?? { userId: '' };
  },
);
