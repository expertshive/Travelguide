import { PrismaClient } from '../src/generated/prisma';
import { hashPassword } from '../src/auth/password.util';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  'user:read',
  'user:write',
  'trip:read',
  'trip:write',
  'place:read',
  'place:write',
  'chat:read',
  'chat:write',
  'payment:read',
  'payment:write',
  'admin:access',
];

const ROLE_DEFINITIONS = [
  {
    name: 'super_admin',
    description: 'Platform super administrator',
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'admin',
    description: 'Platform administrator',
    permissions: ['user:read', 'user:write', 'trip:read', 'trip:write', 'admin:access'],
  },
  {
    name: 'business',
    description: 'Business partner account',
    permissions: ['trip:read', 'trip:write', 'place:read', 'place:write', 'payment:read'],
  },
  {
    name: 'guide',
    description: 'Tour guide account',
    permissions: ['trip:read', 'trip:write', 'place:read', 'chat:read', 'chat:write'],
  },
  {
    name: 'traveler',
    description: 'Traveler account',
    permissions: ['trip:read', 'place:read', 'chat:read'],
  },
];

async function main() {
  for (const name of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, description: name },
    });
  }

  const permissionMap = Object.fromEntries(
    (await prisma.permission.findMany()).map((p) => [p.name, p.id]),
  );

  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: { name: roleDef.name, description: roleDef.description },
    });

    for (const permName of roleDef.permissions) {
      const permissionId = permissionMap[permName];
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
  const email = 'admin@travelerguide.com';
  const password = 'Admin@123456';

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Platform Admin',
      mobile: '+966500000000',
      passwordHash: hashPassword(password),
      isActive: true,
    },
    create: {
      email,
      name: 'Platform Admin',
      mobile: '+966500000000',
      passwordHash: hashPassword(password),
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: user.id, roleId: superAdminRole.id },
  });

  console.log('Seed complete');
  console.log('Admin:', email, '/', password);
  console.log('Roles:', ROLE_DEFINITIONS.map((r) => r.name).join(', '));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
