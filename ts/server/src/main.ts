import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { cors: true });
    app.use(json({ limit: '5mb' }));
    await app.listen(8090);
}
bootstrap();
