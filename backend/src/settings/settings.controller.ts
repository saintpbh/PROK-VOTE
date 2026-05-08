import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminGuard } from '../auth/admin.guard';

@Controller('settings')
@UseGuards(AdminGuard)
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get()
    async getAll() {
        const settings = await this.settingsService.getAllSettings();
        return {
            success: true,
            settings,
        };
    }

    @Get('status')
    async getStatus() {
        const status = await this.settingsService.getSystemStatus();
        return {
            success: true,
            status,
        };
    }

    @Post()
    async update(@Body() body: { key: string, value: string, type: 'string' | 'number' | 'boolean' | 'json' }) {
        const setting = await this.settingsService.updateSetting(body.key, body.value, body.type);
        return {
            success: true,
            setting,
        };
    }

    /**
     * Get current infra scaling preset
     */
    @Get('infra')
    async getInfraPreset() {
        const preset = await this.settingsService.getSetting('infra_preset');
        return {
            success: true,
            preset: preset?.value || 'standby',
        };
    }

    /**
     * Update infra scaling preset
     * Presets: standby (min 0), small (min 1), medium (min 2), max (min 4)
     */
    @Post('infra')
    async updateInfraPreset(@Body() body: { preset: 'standby' | 'small' | 'medium' | 'max' }) {
        const presetConfig: Record<string, { minInstances: number; maxInstances: number; memory: string; cpu: string }> = {
            standby: { minInstances: 0, maxInstances: 2, memory: '512Mi', cpu: '1' },
            small: { minInstances: 1, maxInstances: 4, memory: '512Mi', cpu: '1' },
            medium: { minInstances: 2, maxInstances: 8, memory: '1Gi', cpu: '2' },
            max: { minInstances: 4, maxInstances: 16, memory: '2Gi', cpu: '4' },
        };

        const config = presetConfig[body.preset];
        if (!config) {
            return { success: false, message: 'Invalid preset' };
        }

        // Save the preset selection to DB
        await this.settingsService.updateSetting('infra_preset', body.preset, 'string');
        await this.settingsService.updateSetting('infra_config', JSON.stringify(config), 'json');

        return {
            success: true,
            preset: body.preset,
            config,
            message: `인프라 프리셋이 '${body.preset}'(으)로 변경되었습니다. Cloud Run 콘솔에서 실제 적용이 필요합니다.`,
        };
    }
}
