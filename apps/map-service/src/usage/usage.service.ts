import { Injectable } from '@nestjs/common';
import { createLogger } from '@traveler-guide/logger';
import { PrismaService } from '../prisma/prisma.service';

type UsageOutcome = 'request' | 'error' | 'cacheHit';

/**
 * Daily per-provider call counters. Writes are fire-and-forget: usage
 * accounting must never fail a user-facing map request.
 */
@Injectable()
export class UsageService {
  private readonly logger = createLogger('UsageService');

  constructor(private readonly prisma: PrismaService) {}

  track(provider: string, operation: string, outcome: UsageOutcome): void {
    void this.record(provider, operation, outcome).catch((error: unknown) => {
      this.logger.warn('Failed to record provider usage', {
        provider,
        operation,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private async record(provider: string, operation: string, outcome: UsageOutcome) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);

    const increment = {
      requestCount: outcome === 'request' ? 1 : 0,
      errorCount: outcome === 'error' ? 1 : 0,
      cacheHits: outcome === 'cacheHit' ? 1 : 0,
    };

    await this.prisma.providerUsage.upsert({
      where: { provider_operation_day: { provider, operation, day } },
      create: { provider, operation, day, ...increment },
      update: {
        requestCount: { increment: increment.requestCount },
        errorCount: { increment: increment.errorCount },
        cacheHits: { increment: increment.cacheHits },
      },
    });
  }

  async summary(days = 7) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days);

    return this.prisma.providerUsage.findMany({
      where: { day: { gte: since } },
      orderBy: [{ day: 'desc' }, { provider: 'asc' }],
    });
  }
}
