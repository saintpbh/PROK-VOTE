import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from '../entities/system-setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([SystemSetting]),
        AuthModule, // Required for AdminGuard
    ],
    providers: [SettingsService],
    controllers: [SettingsController],
    exports: [SettingsService],
})
export class SettingsModule { }
