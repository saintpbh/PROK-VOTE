import FingerprintJS from '@fingerprintjs/fingerprintjs';

class FingerprintService {
    private fpPromise: Promise<any> | null = null;
    private cachedFingerprint: string | null = null;

    async initialize() {
        if (!this.fpPromise) {
            this.fpPromise = FingerprintJS.load();
        }
        return this.fpPromise;
    }

    async getFingerprint(): Promise<string> {
        // Check cache first
        if (this.cachedFingerprint) {
            return this.cachedFingerprint;
        }

        // Check localStorage
        const stored = localStorage.getItem('device_fingerprint');
        if (stored) {
            this.cachedFingerprint = stored;
            return stored;
        }

        try {
            // Initialize FingerprintJS
            const fp = await this.initialize();
            const result = await fp.get();

            const fingerprint = result.visitorId;

            // Cache in memory and localStorage
            this.cachedFingerprint = fingerprint;
            localStorage.setItem('device_fingerprint', fingerprint);

            return fingerprint;
        } catch (error) {
            console.error('Failed to get fingerprint:', error);

            // Fallback: generate a random UUID and store in localStorage
            const fallbackId = this.generateFallbackId();
            localStorage.setItem('device_fingerprint', fallbackId);
            this.cachedFingerprint = fallbackId;

            return fallbackId;
        }
    }

    private generateFallbackId(): string {
        return 'fallback-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    clearFingerprint() {
        this.cachedFingerprint = null;
        localStorage.removeItem('device_fingerprint');
    }
}

const fingerprintService = new FingerprintService();
export default fingerprintService;
