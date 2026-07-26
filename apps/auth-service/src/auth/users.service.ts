import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignUserRoleDto, ListUsersQueryDto, UpdateUserDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          userRoles: { include: { role: true } },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        isActive: user.isActive,
        roles: user.userRoles.map((ur) => ur.role.name),
        createdAt: user.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.name)),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      isActive: user.isActive,
      roles,
      permissions,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    await this.ensureUser(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
      include: { userRoles: { include: { role: true } } },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.name),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async assignRole(userId: string, dto: AssignUserRoleDto) {
    await this.ensureUser(userId);
    const role = await this.prisma.role.findUnique({ where: { name: dto.roleName } });
    if (!role) {
      throw new NotFoundException(`Role "${dto.roleName}" not found`);
    }

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });

    return this.getUser(userId);
  }

  async removeRole(userId: string, roleName: string) {
    await this.ensureUser(userId);
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new NotFoundException(`Role "${roleName}" not found`);
    }

    await this.prisma.userRole.deleteMany({
      where: { userId, roleId: role.id },
    });

    return this.getUser(userId);
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
