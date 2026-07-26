import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignRolePermissionsDto,
  CreateRoleDto,
  UpdateRoleDto,
} from './dto/roles.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });
    return permissions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    }));
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map((rp) => rp.permission.name),
      userCount: role._count.userRoles,
    }));
  }

  async getRole(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map((rp) => rp.permission.name),
      userCount: role._count.userRoles,
    };
  }

  async createRole(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists`);
    }

    const role = await this.prisma.role.create({
      data: { name: dto.name, description: dto.description },
    });

    return this.getRole(role.id);
  }

  async updateRole(roleId: string, dto: UpdateRoleDto) {
    await this.ensureRole(roleId);
    await this.prisma.role.update({
      where: { id: roleId },
      data: { description: dto.description },
    });
    return this.getRole(roleId);
  }

  async deleteRole(roleId: string) {
    const role = await this.ensureRole(roleId);
    if (role.name === 'super_admin') {
      throw new BadRequestException('Cannot delete super_admin role');
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return { success: true };
  }

  async setRolePermissions(roleId: string, dto: AssignRolePermissionsDto) {
    await this.ensureRole(roleId);
    const permissions = await this.prisma.permission.findMany({
      where: { name: { in: dto.permissions } },
    });

    if (permissions.length !== dto.permissions.length) {
      throw new BadRequestException('One or more permissions were not found');
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    });

    return this.getRole(roleId);
  }

  private async ensureRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }
}
