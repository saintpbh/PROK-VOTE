import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export enum SmsProvider {
    MOCK = 'mock',
    ALIGO = 'aligo',
    COOLSMS = 'coolsms',
}

export interface SmsResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);

    constructor(private settingsService: SettingsService) { }

    private getSettings() {
        return {
            provider: (this.settingsService.getSetting('SMS_PROVIDER') as SmsProvider) || SmsProvider.MOCK,
            apiKey: this.settingsService.getSetting('SMS_API_KEY', ''),
            senderId: this.settingsService.getSetting('SMS_SENDER_ID', ''),
        };
    }

    /**
     * Send a single SMS with a voting link
     */
    async sendVotingLink(phoneNumber: string, name: string, votingUrl: string): Promise<SmsResponse> {
        const { provider, senderId } = this.getSettings();
        const message = `[PROK Vote] 안녕하세요 ${name}님, 투표에 참여해주세요.\n참여 링크: ${votingUrl}`;

        this.logger.log(`[SMS] Sending to ${phoneNumber} via ${provider} (Sender: ${senderId})`);

        if (provider === SmsProvider.MOCK) {
            return this.sendMockSms(phoneNumber, message);
        }

        // Future implementation for real providers
        return { success: false, error: 'SMS Provider not yet fully integrated' };
    }

    /**
     * Mock SMS implementation - just logs to console
     */
    private async sendMockSms(phoneNumber: string, message: string): Promise<SmsResponse> {
        this.logger.log(`\n--- MOCK SMS SENT ---\nTo: ${phoneNumber}\nMessage:\n${message}\n---------------------\n`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            success: true,
            messageId: `mock_${Date.now()}`,
        };
    }
}
