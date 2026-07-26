import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { createLogger } from '@traveler-guide/logger';

async function bootstrap() {
  const logger = createLogger('api-gateway');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('api-gateway')
    .setDescription('Traveler Guide — api-gateway')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  logger.info('Service started', { port, docs: `http://localhost:${port}/docs`, ws: `ws://localhost:${port}/events` });
}

bootstrap();
