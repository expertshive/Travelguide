import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@traveler-guide/types';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ToggleIntegrationDto, UpdateIntegrationDto } from './dto/integrations.dto';
import { IntegrationsService } from './integrations.service';

/** Third-party API credentials, managed from the admin portal. */
@ApiTags('Integrations')
@ApiBearerAuth()
@Permissions(Permission.ADMIN_ACCESS)
@Controller('auth/admin/integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Every integration with its configuration status' })
  async list() {
    return {
      encryptionReady: this.integrations.encryptionReady(),
      integrations: await this.integrations.list(),
    };
  }

  @Get(':provider')
  @ApiOperation({ summary: 'One integration' })
  get(@Param('provider') provider: string) {
    return this.integrations.get(provider);
  }

  @Put(':provider')
  @ApiOperation({ summary: 'Set or clear credential fields' })
  update(
    @Param('provider') provider: string,
    @Body() dto: UpdateIntegrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrations.update(provider, dto.values, user.userId);
  }

  @Patch(':provider')
  @ApiOperation({ summary: 'Enable or disable an integration' })
  toggle(
    @Param('provider') provider: string,
    @Body() dto: ToggleIntegrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrations.setEnabled(provider, dto.enabled, user.userId);
  }

  @Delete(':provider')
  @ApiOperation({ summary: 'Remove stored credentials, reverting to environment variables' })
  clear(@Param('provider') provider: string, @CurrentUser() user: AuthUser) {
    return this.integrations.clear(provider, user.userId);
  }

  @Post(':provider/test')
  @ApiOperation({ summary: 'Make a live call to the provider and report the result' })
  test(@Param('provider') provider: string) {
    return this.integrations.test(provider);
  }
}
