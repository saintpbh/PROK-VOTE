import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { GeolocationService } from './geolocation.service';
import { FingerprintService } from './fingerprint.service';
import { Session, Token, Voter } from '../entities';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Session, Token, Voter]),
        forwardRef(() => UsersModule),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get('JWT_EXPIRATION') || '24h',
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, TokenService, GeolocationService, FingerprintService],
    exports: [AuthService, TokenService, FingerprintService, JwtModule],
})
export class AuthModule { }
