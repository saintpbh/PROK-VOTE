import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { Session, Agenda, Voter } from '../entities';
import { AuthModule } from '../auth/auth.module';
import { VotingModule } from '../voting/voting.module';
import { UsersModule } from '../users/users.module';
import { SmsModule } from '../sms/sms.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Session, Agenda, Voter]),
        AuthModule, // Import AuthModule to access FingerprintService
        UsersModule,
        SmsModule,
        forwardRef(() => VotingModule),
    ],
    controllers: [SessionController],
    providers: [SessionService],
    exports: [SessionService],
})
export class SessionModule { }
