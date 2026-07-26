import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { createLogger } from '@traveler-guide/logger';

async function bootstrap() {
  const logger = createLogger('payment-service');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('payment-service')
    .setDescription('Traveler Guide — payment-service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 4011;
  await app.listen(port);
  logger.info('Service started', { port, docs: `http://localhost:${port}/docs` });
}

bootstrap();
