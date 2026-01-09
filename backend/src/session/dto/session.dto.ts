import { IsString, IsOptional, IsNumber, IsBoolean, Length, IsEnum, IsArray } from 'class-validator';

export class CreateSessionDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    gpsLat?: number;

    @IsOptional()
    @IsNumber()
    gpsLng?: number;

    @IsOptional()
    @IsNumber()
    gpsRadius?: number;

    @IsOptional()
    @IsBoolean()
    gpsEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    strictDeviceCheck?: boolean;
}

export class CreateAgendaDto {
    @IsString()
    sessionId: string;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    displayOrder?: number;

    @IsOptional()
    @IsBoolean()
    isImportant?: boolean;

    @IsOptional()
    @IsEnum(['PROS_CONS', 'MULTIPLE_CHOICE', 'INPUT'])
    type?: 'PROS_CONS' | 'MULTIPLE_CHOICE' | 'INPUT';

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    options?: string[];
}

export class UpdateAgendaStageDto {
    @IsString()
    stage: 'pending' | 'submitted' | 'voting' | 'ended' | 'announced';
}

export class UpdateSessionSettingsDto {
    @IsOptional()
    @IsString()
    stadiumTheme?: string;

    @IsOptional()
    @IsString()
    voterTheme?: string;

    @IsOptional()
    @IsEnum(['UNIQUE_QR', 'GLOBAL_LINK'])
    entryMode?: 'UNIQUE_QR' | 'GLOBAL_LINK';

    @IsOptional()
    @IsBoolean()
    allowAnonymous?: boolean;

    @IsOptional()
    @IsBoolean()
    strictDeviceCheck?: boolean;
}
