import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './modules/platform/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  app.enableCors({ origin: config.getCorsOrigin() });
  // GraphQL input classes (SignInInput, CreateTaskInput, ...) carry class-validator decorators; this is
  // what actually enforces them, the same way Nest's ValidationPipe enforced the former REST DTOs.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(config.getPort());
}

void bootstrap();
