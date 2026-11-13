import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3220').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT ?? 4220);
  await app.listen(port);
  console.log(`Agro Farm API listening on http://localhost:${port}/api`);
}

bootstrap();
