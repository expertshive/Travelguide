import { ForbiddenException, Module } from '@nestjs/common';
import { DbAdminModule, type DeleteGuard } from '@traveler-guide/db-admin';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

type RoleLookup = {
  role: { findUnique(args: unknown): Promise<{ name: string } | null> };
};

/**
 * Rows whose removal would lock everybody out of the system. The generic editor
 * happily deletes anything with a primary key, so these are enforced here.
 */
const guards: DeleteGuard[] = [
  ({ accessor, where, currentUserId }) => {
    if (accessor === 'user' && where.id === currentUserId) {
      throw new ForbiddenException('You cannot delete your own account.');
    }
  },
  async ({ accessor, where, prisma }) => {
    if (accessor !== 'role' || !where.id) return;
    const role = await (prisma as unknown as RoleLookup).role.findUnique({
      where: { id: where.id },
    });
    if (role?.name === 'super_admin') {
      throw new ForbiddenException('The super_admin role is protected.');
    }
  },
];

@Module({
  imports: [
    DbAdminModule.forRoot({
      segment: 'auth',
      label: 'Auth',
      models: Prisma.dmmf.datamodel.models,
      prisma: PrismaService,
      guards,
    }),
  ],
})
export class AuthDbAdminModule {}
