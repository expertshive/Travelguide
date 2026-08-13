import { Module } from '@nestjs/common';
import { DbAdminModule } from '@traveler-guide/db-admin';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    DbAdminModule.forRoot({
      segment: 'places',
      label: 'Places',
      models: Prisma.dmmf.datamodel.models,
      prisma: PrismaService,
    }),
  ],
})
export class PlacesDbAdminModule {}
