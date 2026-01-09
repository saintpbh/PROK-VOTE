import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class FingerprintService {
    /**
     * Validate a fingerprint format
     * @param fingerprint Device fingerprint string
     * @returns Boolean indicating if fingerprint is valid
     */
    validateFingerprint(fingerprint: string): boolean {
        // Basic validation: should be a non-empty string with reasonable length
        return fingerprint && fingerprint.length >= 20 && fingerprint.length <= 500;
    }

    /**
     * Generate a hash of the fingerprint for storage
     * @param fingerprint Raw fingerprint
     * @returns Hashed fingerprint
     */
    hashFingerprint(fingerprint: string): string {
        return crypto.createHash('sha256').update(fingerprint).digest('hex');
    }

    /**
     * Generate a random access code (4 digits)
     * @returns 4-digit access code string
     */
    generateAccessCode(): string {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }
}
