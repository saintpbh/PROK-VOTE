import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { FingerprintService } from './fingerprint.service';
import {
    GenerateTokensDto,
    VerifyQRDto,
    VerifyGPSDto,
    VerifyAccessCodeDto,
    CompleteAuthDto,
    UserLoginDto,
    GlobalAuthDto,
} from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';

import { AdminGuard } from './admin.guard';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private tokenService: TokenService,
        private fingerprintService: FingerprintService,
    ) { }

    /**
     * Generate QR tokens for a session (Admin only)
     * POST /auth/generate-tokens
     */
    @Post('generate-tokens')
    @UseGuards(AdminGuard)
    async generateTokens(@Body() dto: GenerateTokensDto) {
        const tokenIds = await this.tokenService.generateTokens(dto.sessionId, dto.count);
        return {
            success: true,
            count: tokenIds.length,
            tokens: tokenIds,
        };
    }

    /**
     * Verify QR token and bind to device
     * POST /auth/verify-qr
     */
    @Post('verify-qr')
    @HttpCode(HttpStatus.OK)
    async verifyQR(@Body() dto: VerifyQRDto) {
        const token = await this.tokenService.bindTokenToDevice(
            dto.tokenId,
            dto.deviceFingerprint,
        );

        return {
            success: true,
            message: 'Device bound successfully',
            sessionId: token.sessionId,
        };
    }

    /**
     * Complete authentication (QR + GPS + Access Code)
     * POST /auth/complete
     */
    @Post('complete')
    @HttpCode(HttpStatus.OK)
    async completeAuth(@Body() dto: CompleteAuthDto, @Req() req: Request) {
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        const result = await this.authService.completeAuthentication(dto, ipAddress, userAgent);

        return {
            success: true,
            accessToken: result.accessToken,
            voter: {
                id: result.voter.id,
                sessionId: result.voter.sessionId,
            },
        };
    }

    /**
     * Complete authentication via Global Link
     * POST /auth/global
     */
    @Post('global')
    @HttpCode(HttpStatus.OK)
    async globalAuth(@Body() dto: GlobalAuthDto, @Req() req: Request) {
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        const result = await this.authService.globalAuthentication(dto, ipAddress, userAgent);

        return {
            success: true,
            accessToken: result.accessToken,
            voter: {
                id: result.voter.id,
                sessionId: result.voter.sessionId,
                name: result.voter.name,
            },
        };
    }

    /**
     * Get token information
     * GET /auth/token/:tokenId
     */
    @Get('token/:tokenId')
    async getToken(@Param('tokenId') tokenId: string) {
        const token = await this.tokenService.getTokenWithSession(tokenId);

        if (!token) {
            return {
                success: false,
                message: 'Token not found',
            };
        }

        return {
            success: true,
            token: {
                id: token.id,
                isRevoked: token.isRevoked,
                isBound: !!token.deviceFingerprint,
                session: token.session
                    ? {
                        id: token.session.id,
                        name: token.session.name,
                        gpsEnabled: token.session.gpsEnabled,
                        status: token.session.status,
                    }
                    : null,
            },
        };
    }

    /**
     * Generate a new access code
     * GET /auth/generate-code
     */
    @Get('generate-code')
    generateAccessCode() {
        const code = this.fingerprintService.generateAccessCode();
        return {
            success: true,
            code,
        };
    }

    /**
     * Admin Login
     * POST /auth/admin/login
     */
    @Post('admin/login')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    async adminLogin(@Body() dto: UserLoginDto, @Req() req: Request) {
        const result = await this.authService.userLogin(dto, req);
        return {
            success: true,
            accessToken: result.accessToken,
            user: result.user
        };
    }

    /**
     * Public User Registration
     * POST /auth/register
     */
    @Post('register')
    @Throttle({ default: { limit: 3, ttl: 60000 } }) // Max 3 registrations per minute per IP
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() data: { username: string; password: string; email?: string }, @Req() req: Request) {
        return await this.authService.registerUser(data, req);
    }
}
