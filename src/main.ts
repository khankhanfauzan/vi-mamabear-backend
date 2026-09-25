import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transformer.interceptor';
import { AllExceptionsFilter } from './common/filters/exceptions.filter';
import { Logger, PinoLogger } from 'pino-nestjs';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(cookieParser());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(await app.resolve(PinoLogger)));
  app.setGlobalPrefix('/api');

  app.enableCors({
    origin: [
      process.env.CORS_ORIGIN,
      'http://localhost:3000',
      /^http:\/\/localhost:\d+$/,
      'null',
      "https://vi-mamabear-frontend.vercel.app",
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('MamaBear API')
    .setDescription('MamaBear Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JwtAuthGuard', // 🔑 This name must match the @ApiBearerAuth decorator
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  if (process.env.NODE_ENV == 'ci') {
    await app.listen(port, '0.0.0.0');
    const timeMs = 30000;
    console.log(`[ci] Aborting application within ${timeMs}`);
    setTimeout(async () => {
      await app.close();
      process.exit(0);
    }, 10000);
  } else {
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 App listening on http://0.0.0.0:${port}`);
  }
}
await bootstrap();
