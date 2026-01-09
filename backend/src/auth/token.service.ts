import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token } from '../entities';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TokenService {
    constructor(
        @InjectRepository(Token)
        private tokenRepository: Repository<Token>,
    ) { }

    /**
     * Generate multiple QR tokens for a session
     * @param sessionId Session UUID
     * @param count Number of tokens to generate
     * @returns Array of generated token UUIDs
     */
    async generateTokens(sessionId: string, count: number): Promise<string[]> {
        const tokens: Token[] = [];

        for (let i = 0; i < count; i++) {
            const token = this.tokenRepository.create({
                sessionId,
            });
            tokens.push(token);
        }

        const savedTokens = await this.tokenRepository.save(tokens);
        return savedTokens.map((t) => t.id);
    }

    /**
     * Bind a token to a device fingerprint
     * @param tokenId Token UUID
     * @param fingerprint Device fingerprint
     * @returns Updated token
     */
    async bindTokenToDevice(tokenId: string, fingerprint: string): Promise<Token> {
        const token = await this.tokenRepository.findOne({
            where: { id: tokenId },
            relations: ['session'],
        });

        if (!token) {
            throw new Error('Token not found');
        }

        if (token.isRevoked) {
            throw new Error('Token has been revoked');
        }

        if (token.deviceFingerprint && token.deviceFingerprint !== fingerprint) {
            throw new Error('Token already bound to another device');
        }

        token.deviceFingerprint = fingerprint;
        token.boundAt = new Date();

        return await this.tokenRepository.save(token);
    }

    /**
     * Verify token and device fingerprint match
     * @param tokenId Token UUID
     * @param fingerprint Device fingerprint
     * @returns Boolean indicating match status
     */
    async verifyTokenDevice(tokenId: string, fingerprint: string): Promise<boolean> {
        const token = await this.tokenRepository.findOne({
            where: { id: tokenId },
        });

        if (!token || token.isRevoked) {
            return false;
        }

        return token.deviceFingerprint === fingerprint;
    }

    /**
     * Revoke all tokens for a session (for "important vote" mode)
     * @param sessionId Session UUID
     * @returns Number of tokens revoked
     */
    async revokeSessionTokens(sessionId: string): Promise<number> {
        const result = await this.tokenRepository.update(
            { sessionId, isRevoked: false },
            { isRevoked: true },
        );

        return result.affected || 0;
    }

    /**
     * Get token with session details
     * @param tokenId Token UUID
     * @returns Token with session relationship
     */
    async getTokenWithSession(tokenId: string): Promise<Token> {
        return await this.tokenRepository.findOne({
            where: { id: tokenId },
            relations: ['session'],
        });
    }
}
