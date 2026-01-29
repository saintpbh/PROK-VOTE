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
            const rawAllowedOrigins = [
                'http://localhost:3000',
                'http://192.168.1.211:3010',
                configService.get('FRONTEND_URL'),
                configService.get('PRODUCTION_URL'),
            ].filter(Boolean);

            // Normalize: remove trailing slash
            const allowedOrigins = rawAllowedOrigins.map(o => o.replace(/\/$/, ''));
            const normalizedOrigin = requestOrigin ? requestOrigin.replace(/\/$/, '') : null;

            if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
                callback(null, true);
            } else {
                console.log('[CORS] Blocked origin:', requestOrigin);
                console.log('[CORS] Allowed origins (normalized):', allowedOrigins);
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
    await app.listen(port, '0.0.0.0');

    console.log(`🚀 PROK Vote Backend running on http://192.168.1.211:${port}`);
    console.log(`🔌 WebSocket server ready for real-time connections (Listening on 0.0.0.0)`);
}

bootstrap();
