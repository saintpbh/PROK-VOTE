import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Session, Token, Voter } from '../entities';
import { TokenService } from './token.service';
import { GeolocationService } from './geolocation.service';
import { FingerprintService } from './fingerprint.service';
import { CompleteAuthDto, UserLoginDto } from './dto/auth.dto';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(Session)
        private sessionRepository: Repository<Session>,
        @InjectRepository(Voter)
        private voterRepository: Repository<Voter>,
        private tokenService: TokenService,
        private geoService: GeolocationService,
        private fingerprintService: FingerprintService,
        private jwtService: JwtService,
        private usersService: UsersService,
    ) { }

    /**
     * Complete authentication process (QR + GPS + Access Code)
     * @param dto Complete authentication data
     * @param ipAddress Client IP address
     * @param userAgent Client user agent
     * @returns JWT token and voter information
     */
    async completeAuthentication(
        dto: CompleteAuthDto,
        ipAddress: string,
        userAgent: string,
    ): Promise<{ accessToken: string; voter: Voter }> {
        // 1. Get token and session
        const token = await this.tokenService.getTokenWithSession(dto.tokenId);
        if (!token || !token.session) {
            throw new UnauthorizedException('Invalid token');
        }

        if (token.isRevoked) {
            throw new UnauthorizedException('Token has been revoked. Please re-authenticate.');
        }

        const session = token.session;

        // 2. Validate device fingerprint
        if (!this.fingerprintService.validateFingerprint(dto.deviceFingerprint)) {
            throw new BadRequestException('Invalid device fingerprint');
        }

        // 3. Bind token to device (if not already bound)
        await this.tokenService.bindTokenToDevice(dto.tokenId, dto.deviceFingerprint);

        // 4. Verify GPS location
        this.verifyGPS(session, dto);

        // 5. Verify access code
        this.verifyAccessCode(session, dto.accessCode);

        // 6. Create or update voter record
        let voter = await this.voterRepository.findOne({
            where: { tokenId: dto.tokenId },
        });

        if (!voter) {
            // Check voter quota
            const voterCount = await this.voterRepository.count({ where: { sessionId: session.id } });
            const owner = await this.usersService.findById(session.ownerId);

            if (owner && voterCount >= owner.maxVotersPerSession) {
                throw new ForbiddenException(`Session is full (limit: ${owner.maxVotersPerSession}).`);
            }

            voter = this.voterRepository.create({
                tokenId: dto.tokenId,
                sessionId: session.id,
                gpsLat: dto.latitude,
                gpsLng: dto.longitude,
                deviceFingerprint: dto.deviceFingerprint,
                accessCodeVerified: true,
            });
            await this.voterRepository.save(voter);
        } else {
            // Update fingerprint if it changed or was missing
            if (voter.deviceFingerprint !== dto.deviceFingerprint) {
                voter.deviceFingerprint = dto.deviceFingerprint;
                await this.voterRepository.save(voter);
            }
        }

        // 7. Generate JWT token
        const payload = {
            voterId: voter.id,
            sessionId: session.id,
            tokenId: dto.tokenId,
        };

        const accessToken = this.jwtService.sign(payload);

        return { accessToken, voter };
    }

    /**
     * Complete authentication process via Global Link
     */
    async globalAuthentication(
        dto: any, // GlobalAuthDto but avoided circular or complex type mapping here for simple replacement
        ipAddress: string,
        userAgent: string,
    ): Promise<{ accessToken: string; voter: Voter }> {
        // 1. Get session
        const session = await this.sessionRepository.findOne({
            where: { id: dto.sessionId },
        });

        if (!session) {
            throw new UnauthorizedException('Invalid session');
        }

        if (session.entryMode !== 'GLOBAL_LINK') {
            throw new UnauthorizedException('This session does not allow global link entry');
        }

        // 2. Validate device fingerprint
        if (!this.fingerprintService.validateFingerprint(dto.deviceFingerprint)) {
            throw new BadRequestException('Invalid device fingerprint');
        }

        // 3. Verify GPS location
        this.verifyGPS(session, dto);

        // 4. Verify access code
        this.verifyAccessCode(session, dto.accessCode);

        // 5. Check if voter already exists for this device in this session
        let voter = null;
        if (session.strictDeviceCheck) {
            voter = await this.voterRepository.findOne({
                where: {
                    sessionId: session.id,
                    deviceFingerprint: dto.deviceFingerprint
                }
            });
        }

        if (!voter) {
            // Check voter quota
            const voterCount = await this.voterRepository.count({ where: { sessionId: session.id } });
            const owner = await this.usersService.findById(session.ownerId);

            if (owner && voterCount >= owner.maxVotersPerSession) {
                throw new ForbiddenException(`Session is full (limit: ${owner.maxVotersPerSession}).`);
            }

            // 6. Create voter record
            voter = this.voterRepository.create({
                sessionId: session.id,
                name: dto.name,
                gpsLat: dto.latitude,
                gpsLng: dto.longitude,
                deviceFingerprint: dto.deviceFingerprint,
                accessCodeVerified: true,
            });
            await this.voterRepository.save(voter);
        } else if (dto.name && voter.name !== dto.name) {
            // Update name if it changed
            voter.name = dto.name;
            await this.voterRepository.save(voter);
        }

        // 6. Generate JWT token
        const payload = {
            voterId: voter.id,
            sessionId: session.id,
            name: voter.name,
        };

        const accessToken = this.jwtService.sign(payload);

        return { accessToken, voter };
    }

    private verifyGPS(session: Session, dto: any) {
        if (session.gpsEnabled && !dto.skipGPS) {
            if (!session.gpsLat || !session.gpsLng) {
                throw new BadRequestException('GPS verification required but session location not set');
            }

            const verification = this.geoService.verifyWithinRadius(
                { latitude: dto.latitude, longitude: dto.longitude },
                { latitude: session.gpsLat, longitude: session.gpsLng },
                session.gpsRadius,
            );

            if (!verification.isWithin) {
                throw new UnauthorizedException(
                    `Location verification failed. You are ${verification.distance}m away from the venue.`,
                );
            }
        }
    }

    private verifyAccessCode(session: Session, accessCode: string) {
        if (accessCode !== session.accessCode) {
            throw new UnauthorizedException('Invalid access code');
        }

        // Check if code is expired
        if (session.codeExpiresAt && new Date() > session.codeExpiresAt) {
            throw new UnauthorizedException('Access code has expired');
        }
    }

    /**
     * Verify JWT token
     * @param token JWT token string
     * @returns Decoded payload
     */
    async verifyAccessToken(token: string): Promise<any> {
        try {
            return this.jwtService.verify(token);
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    /**
     * Get voter by ID with session information
     * @param voterId Voter UUID
     * @returns Voter with session
     */
    async getVoterWithSession(voterId: string): Promise<Voter> {
        return await this.voterRepository.findOne({
            where: { id: voterId },
            relations: ['session', 'token'],
        });
    }

    /**
     * User (Super Admin or Manager) Login
     */
    async userLogin(dto: UserLoginDto): Promise<{ accessToken: string; user: any }> {
        const user = await this.usersService.findByUsername(dto.username);

        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid credentials or inactive account');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            console.log(`[Auth] Login failed for user: ${dto.username} (Invalid Password)`);
            throw new UnauthorizedException('Invalid credentials');
        }

        console.log(`[Auth] Login successful for user: ${dto.username} (Role: ${user.role})`);

        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            sub: user.id,
        };

        const accessToken = this.jwtService.sign(payload);

        // Don't return password hash
        const { passwordHash, ...userWithoutPassword } = user;

        return {
            accessToken,
            user: userWithoutPassword
        };
    }

    /**
     * Public User Registration
     */
    async registerUser(data: { username: string; password: string; email?: string }): Promise<{ success: boolean; message: string }> {
        // Check if username already exists
        const existingUser = await this.usersService.findByUsername(data.username);
        if (existingUser) {
            throw new BadRequestException('Username already exists');
        }

        // Validate username format (3-20 alphanumeric + underscore)
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(data.username)) {
            throw new BadRequestException('Username must be 3-20 characters (alphanumeric and underscore only)');
        }

        // Validate password length
        if (data.password.length < 6) {
            throw new BadRequestException('Password must be at least 6 characters');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // Create user with default free-tier quotas
        await this.usersService.createUser({
            username: data.username,
            email: data.email,
            passwordHash,
            role: 'VOTE_MANAGER' as any,
            isActive: true,
            maxSessions: 5,
            maxAgendasPerSession: 20,
            maxVotersPerSession: 500,
        });

        return {
            success: true,
            message: 'Account created successfully. You can now log in.'
        };
    }
}
