import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // удаляет неизвестные поля
      forbidNonWhitelisted: true, // если прислали лишнее - 400
      transform: true,            // приводит типы ("1" - 1)
    }),
  );

  await app.listen(3000);
}
bootstrap();
