import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { SettingsService } from '../settings/settings.service';
import { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';

@Injectable()
export class DynamicThrottlerGuard extends ThrottlerGuard {
    constructor(
        options: ThrottlerModuleOptions,
        storageService: ThrottlerStorage,
        reflector: Reflector,
        private readonly settingsService: SettingsService,
    ) {
        super(options, storageService, reflector);
    }

    protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
        const dynamicLimit = this.settingsService.getSetting('RATE_LIMIT', 10000);

        // Pass the dynamic limit to the parent handler
        return super.handleRequest({
            ...requestProps,
            limit: dynamicLimit,
        });
    }
}
