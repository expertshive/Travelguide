import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { IntegrationsService } from './integrations.service';
import { InternalTokenGuard } from './internal-token.guard';

/**
 * Hands resolved credentials to other services.
 *
 * `@Public()` only switches off the user-token guards — {@link InternalTokenGuard}
 * takes their place. Kept out of the published API docs because it is not part
 * of the client-facing surface.
 */
@ApiExcludeController()
@Public()
@UseGuards(InternalTokenGuard)
@Controller('auth/internal/integrations')
export class InternalIntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get(':provider')
  async values(@Param('provider') provider: string) {
    return { provider, values: await this.integrations.resolveValues(provider) };
  }
}
