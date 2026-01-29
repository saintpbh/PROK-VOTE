import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as os from 'os';
import { SystemSetting } from '../entities/system-setting.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
    private cache = new Map<string, any>();

    constructor(
        @InjectRepository(SystemSetting)
        private settingsRepository: Repository<SystemSetting>,
    ) { }

    async onModuleInit() {
        await this.loadAllToCache();

        // Ensure default rate limit exists
        if (!this.cache.has('RATE_LIMIT')) {
            await this.updateSetting('RATE_LIMIT', '10000', 'number');
        }
    }

    private async loadAllToCache() {
        const settings = await this.settingsRepository.find();
        settings.forEach(s => {
            this.cache.set(s.key, this.parseValue(s.value, s.type));
        });
    }

    getSetting(key: string, defaultValue?: any): any {
        return this.cache.has(key) ? this.cache.get(key) : defaultValue;
    }

    async updateSetting(key: string, value: string, type: 'string' | 'number' | 'boolean' | 'json' = 'string') {
        let setting = await this.settingsRepository.findOne({ where: { key } });

        if (!setting) {
            setting = this.settingsRepository.create({ key, value, type });
        } else {
            setting.value = value;
            setting.type = type;
        }

        await this.settingsRepository.save(setting);
        this.cache.set(key, this.parseValue(value, type));
        return setting;
    }

    async getAllSettings() {
        return await this.settingsRepository.find();
    }

    async getSystemStatus() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const cpus = os.cpus();
        const loadAvg = os.loadavg();

        return {
            platform: os.platform(),
            arch: os.arch(),
            cpus: cpus.length,
            cpuModel: cpus[0].model,
            memory: {
                total: totalMem,
                free: freeMem,
                used: usedMem,
                usagePercent: Math.round((usedMem / totalMem) * 100),
            },
            loadAvg: {
                '1m': loadAvg[0],
                '5m': loadAvg[1],
                '15m': loadAvg[2],
            },
            uptime: os.uptime(),
            processUptime: process.uptime(),
            nodeVersion: process.version,
        };
    }

    private parseValue(value: string, type: string) {
        switch (type) {
            case 'number': return Number(value);
            case 'boolean': return value === 'true';
            case 'json': try { return JSON.parse(value); } catch { return value; }
            default: return value;
        }
    }
}
