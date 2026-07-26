import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@traveler-guide/types';
import { Permissions } from './decorators/permissions.decorator';
import {
  AssignRolePermissionsDto,
  CreateRoleDto,
  UpdateRoleDto,
} from './dto/roles.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('auth/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions/list')
  @Permissions(Permission.ADMIN_ACCESS)
  @ApiOperation({ summary: 'List all permissions' })
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get()
  @Permissions(Permission.ADMIN_ACCESS)
  @ApiOperation({ summary: 'List all roles' })
  list() {
    return this.rolesService.listRoles();
  }

  @Get(':id')
  @Permissions(Permission.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Get role by ID' })
  get(@Param('id') id: string) {
    return this.rolesService.getRole(id);
  }

  @Post()
  @Permissions(Permission.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Create a new role' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Patch(':id')
  @Permissions(Permission.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Update role metadata' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Delete a role' })
  remove(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }

  @Put(':id/permissions')
  @Permissions(Permission.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Replace role permissions' })
  setPermissions(@Param('id') id: string, @Body() dto: AssignRolePermissionsDto) {
    return this.rolesService.setRolePermissions(id, dto);
  }
}
