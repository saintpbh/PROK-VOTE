import {
    IsString,
    IsNumber,
    IsOptional,
    IsBoolean,
    Min,
    Max,
    Length,
} from 'class-validator';

export class GenerateTokensDto {
    @IsString()
    sessionId: string;

    @IsNumber()
    @Min(1)
    @Max(500)
    count: number;
}

export class VerifyQRDto {
    @IsString()
    tokenId: string;

    @IsString()
    @Length(20, 500)
    deviceFingerprint: string;
}

export class VerifyGPSDto {
    @IsString()
    tokenId: string;

    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number;

    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number;
}

export class VerifyAccessCodeDto {
    @IsString()
    tokenId: string;

    @IsString()
    @Length(4, 4)
    accessCode: string;
}

export class CompleteAuthDto {
    @IsString()
    tokenId: string;

    @IsString()
    deviceFingerprint: string;

    @IsNumber()
    latitude: number;

    @IsNumber()
    longitude: number;

    @IsString()
    @Length(4, 4)
    accessCode: string;


    @IsOptional()
    @IsBoolean()
    skipGPS?: boolean;
}

export class GlobalAuthDto {
    @IsString()
    sessionId: string;

    @IsString()
    @Length(1, 100)
    name: string;

    @IsString()
    deviceFingerprint: string;

    @IsNumber()
    latitude: number;

    @IsNumber()
    longitude: number;

    @IsString()
    @Length(4, 4)
    accessCode: string;

    @IsOptional()
    @IsBoolean()
    skipGPS?: boolean;
}

export class UserLoginDto {
    @IsString()
    username: string;

    @IsString()
    password: string;
}
