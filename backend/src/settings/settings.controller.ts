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
}
