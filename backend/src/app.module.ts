import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { VotingModule } from './voting/voting.module';
import { SessionModule } from './session/session.module';
import { SettingsModule } from './settings/settings.module';
import { DynamicThrottlerGuard } from './auth/dynamic-throttler.guard';
import { UsersModule } from './users/users.module';
import { SmsModule } from './sms/sms.module';
import { AuditModule } from './audit/audit.module';

@Module({
    imports: [
        // Environment configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Rate Limiting (Global)
        ThrottlerModule.forRoot([{
            ttl: 60000, // 1 minute
            limit: 300, // 300 requests per minute per IP (supports 2000 users behind shared NAT)
        }]),

        // Serve static files (uploads)
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads',
        }),

        // PostgreSQL configuration
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('DATABASE_HOST'),
                port: configService.get('DATABASE_PORT'),
                username: configService.get('DATABASE_USER'),
                password: configService.get('DATABASE_PASSWORD'),
                database: configService.get('DATABASE_NAME'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: configService.get('DATABASE_SYNCHRONIZE') === 'true' || configService.get('NODE_ENV') === 'development',
                logging: configService.get('NODE_ENV') === 'development' || configService.get('DATABASE_LOGGING') === 'true',
                // Connection pool for 2000+ concurrent users (max 5 instances × 50 = 250 conn)
                extra: {
                    max: 50,
                    connectionTimeoutMillis: 3000,
                    idleTimeoutMillis: 10000,
                    statement_timeout: 5000,
                },
            }),
        }),

        // Feature modules
        AuthModule,
        VotingModule,
        SessionModule,
        SettingsModule,
        UsersModule,
        SmsModule,
        AuditModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: DynamicThrottlerGuard,
        },
    ],
})
export class AppModule { }
