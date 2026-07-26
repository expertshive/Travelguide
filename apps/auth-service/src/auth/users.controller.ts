import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@traveler-guide/types';
import { Permissions } from './decorators/permissions.decorator';
import { AssignUserRoleDto, ListUsersQueryDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('auth/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(Permission.USER_READ)
  @ApiOperation({ summary: 'List all users (admin)' })
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  @Permissions(Permission.USER_READ)
  @ApiOperation({ summary: 'Get user by ID' })
  get(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }

  @Patch(':id')
  @Permissions(Permission.USER_WRITE)
  @ApiOperation({ summary: 'Update user (activate/deactivate)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Post(':id/roles')
  @Permissions(Permission.USER_WRITE)
  @ApiOperation({ summary: 'Assign role to user' })
  assignRole(@Param('id') id: string, @Body() dto: AssignUserRoleDto) {
    return this.usersService.assignRole(id, dto);
  }

  @Delete(':id/roles/:roleName')
  @Permissions(Permission.USER_WRITE)
  @ApiOperation({ summary: 'Remove role from user' })
  removeRole(@Param('id') id: string, @Param('roleName') roleName: string) {
    return this.usersService.removeRole(id, roleName);
  }
}
