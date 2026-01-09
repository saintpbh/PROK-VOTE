import { IsString, IsEnum } from 'class-validator';

export class CastVoteDto {
    @IsString()
    agendaId: string;

    @IsEnum(['찬성', '반대', '기권'])
    choice: '찬성' | '반대' | '기권';
}
