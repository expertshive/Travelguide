import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ensureUploadDir, UPLOAD_DIR, UPLOAD_URL_PREFIX } from './profile/upload.config';
import { createLogger } from '@traveler-guide/logger';

async function bootstrap() {
  const logger = createLogger('user-service');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true, credentials: true });

  ensureUploadDir();
  app.useStaticAssets(UPLOAD_DIR, { prefix: `/v1${UPLOAD_URL_PREFIX}/` });

  const config = new DocumentBuilder()
    .setTitle('user-service')
    .setDescription('Traveler Guide — user-service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 4002;
  await app.listen(port);
  logger.info('Service started', { port, docs: `http://localhost:${port}/docs` });
}

bootstrap();
