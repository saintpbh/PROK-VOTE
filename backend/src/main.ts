import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Enable CORS for frontend
    app.enableCors({
        origin: (requestOrigin, callback) => {
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:3010',
                configService.get('FRONTEND_URL'),
                configService.get('PRODUCTION_URL'),
            ].filter(Boolean);

            if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
                callback(null, true);
            } else {
                console.log('Blocked CORS origin:', requestOrigin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    const port = configService.get('PORT') || 3001;
    await app.listen(port);

    console.log(`🚀 PROK Vote Backend running on http://localhost:${port}`);
    console.log(`🔌 WebSocket server ready for real-time connections`);
}

bootstrap();
