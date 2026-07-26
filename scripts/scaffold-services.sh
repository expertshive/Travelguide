#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

declare -a SERVICES=(
  "api-gateway:4000:"
  "auth-service:4001:traveler_auth"
  "user-service:4002:traveler_user"
  "trip-service:4003:traveler_trip"
  "place-service:4004:traveler_place"
  "navigation-service:4005:traveler_navigation"
  "social-service:4006:traveler_social"
  "chat-service:4007:traveler_chat"
  "notification-service:4008:traveler_notification"
  "media-service:4009:traveler_media"
  "ai-service:4010:traveler_ai"
  "payment-service:4011:traveler_payment"
  "business-service:4012:traveler_business"
)

NEST_DEPS='@nestjs/common @nestjs/core @nestjs/platform-express @nestjs/config @nestjs/swagger @nestjs/terminus @nestjs/jwt @nestjs/passport @nestjs/microservices @nestjs/websockets @nestjs/platform-socket.io reflect-metadata rxjs passport passport-jwt class-validator class-transformer amqplib ioredis'
NEST_DEV='@nestjs/cli @nestjs/schematics @nestjs/testing @types/express @types/node @types/passport-jwt typescript ts-node tsconfig-paths'

for entry in "${SERVICES[@]}"; do
  IFS=':' read -r name port db <<< "$entry"
  dir="apps/$name"
  mkdir -p "$dir/src/health" "$dir/src/common/filters" "$dir/src/common/interceptors" "$dir/src/rabbitmq"

  cat > "$dir/package.json" <<EOF
{
  "name": "@traveler-guide/$name",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "lint": "eslint \"src/**/*.ts\"",
    "type-check": "tsc -p tsconfig.json --noEmit",
    "test": "jest --passWithNoTests",
    "clean": "rm -rf dist",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.15",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/microservices": "^10.4.15",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.15",
    "@nestjs/platform-socket.io": "^10.4.15",
    "@nestjs/swagger": "^8.1.0",
    "@nestjs/terminus": "^10.2.3",
    "@nestjs/websockets": "^10.4.15",
    "@traveler-guide/config": "workspace:*",
    "@traveler-guide/contracts": "workspace:*",
    "@traveler-guide/logger": "workspace:*",
    "@traveler-guide/types": "workspace:*",
    "amqplib": "^0.10.5",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "ioredis": "^5.4.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "socket.io": "^4.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.9",
    "@nestjs/schematics": "^10.2.3",
    "@nestjs/testing": "^10.4.15",
    "@traveler-guide/eslint-config": "workspace:*",
    "@traveler-guide/tsconfig": "workspace:*",
    "@types/express": "^4.17.21",
    "@types/node": "^20.17.10",
    "@types/passport-jwt": "^4.0.1",
    "eslint": "^9.17.0",
    "jest": "^29.7.0",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3"
  }
}
EOF

  if [ -n "$db" ]; then
    mkdir -p "$dir/prisma" "$dir/src/prisma"
    node -e "
      const fs=require('fs');
      const p=JSON.parse(fs.readFileSync('$dir/package.json','utf8'));
      p.dependencies['@prisma/client']='^6.1.0';
      p.devDependencies.prisma='^6.1.0';
      fs.writeFileSync('$dir/package.json', JSON.stringify(p,null,2));
    "
    cat > "$dir/prisma/schema.prisma" <<PRISMA
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model ServiceRecord {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("service_records")
}
PRISMA
  fi

  cat > "$dir/nest-cli.json" <<EOF
{
  "\$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
EOF

  cat > "$dir/tsconfig.json" <<EOF
{
  "extends": "@traveler-guide/tsconfig/nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

  cat > "$dir/tsconfig.build.json" <<EOF
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
EOF

  cat > "$dir/src/common/filters/http-exception.filter.ts" <<'TS'
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.message : 'Internal server error';

    response.status(status).json({
      success: false,
      error: { code: HttpStatus[status] ?? 'ERROR', message },
    });
  }
}
TS

  cat > "$dir/src/common/interceptors/response.interceptor.ts" <<'TS'
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
TS

  cat > "$dir/src/rabbitmq/rabbitmq.module.ts" <<'TS'
import { Global, Module } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq.service';

@Global()
@Module({
  providers: [RabbitmqService],
  exports: [RabbitmqService],
})
export class RabbitmqModule {}
TS

  cat > "$dir/src/rabbitmq/rabbitmq.service.ts" <<'TS'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@traveler-guide/logger';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('RabbitmqService');
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) return;
    this.connected = true;
    this.logger.info('RabbitMQ configured', { url: url.replace(/:[^:@]+@/, ':***@') });
  }

  async onModuleDestroy() {
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}
TS

  cat > "$dir/src/health/health.controller.ts" <<EOF
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Service health check' })
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
EOF

  cat > "$dir/src/app.module.ts" <<EOF
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    RabbitmqModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
EOF

  cat > "$dir/src/main.ts" <<EOF
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { createLogger } from '@traveler-guide/logger';

async function bootstrap() {
  const logger = createLogger('$name');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('$name')
    .setDescription('Traveler Guide — $name')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? $port;
  await app.listen(port);
  logger.info('Service started', { port, docs: \`http://localhost:\${port}/docs\` });
}

bootstrap();
EOF

  echo "Scaffolded $name"
done

echo "Done scaffolding services"
