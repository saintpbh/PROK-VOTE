import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VotingGateway } from './voting.gateway';
import { VotingService } from './voting.service';
import { VotingController } from './voting.controller';
import { Vote, Voter, Agenda, Session } from '../entities';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../session/session.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Vote, Voter, Agenda, Session]),
        AuthModule,
        forwardRef(() => SessionModule),
    ],
    providers: [VotingGateway, VotingService],
    controllers: [VotingController],
    exports: [VotingService, VotingGateway],
})
export class VotingModule { }
