import { Injectable, Inject, forwardRef, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Session, Agenda, Voter, Token } from '../entities';
import { FingerprintService } from '../auth/fingerprint.service';
import { CreateSessionDto, CreateAgendaDto } from './dto/session.dto';
import { VotingGateway } from '../voting/voting.gateway';
import { UserRole } from '../entities/user.entity';
import { UsersService } from '../users/users.service';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    constructor(
        private configService: ConfigService,
        @InjectRepository(Session)
        private sessionRepository: Repository<Session>,
        @InjectRepository(Agenda)
        private agendaRepository: Repository<Agenda>,
        private fingerService: FingerprintService,
        @Inject(forwardRef(() => VotingGateway))
        private votingGateway: VotingGateway,
        private usersService: UsersService,
        private smsService: SmsService,
        @InjectRepository(Voter)
        private voterRepository: Repository<Voter>,
    ) { }

    /**
     * Create a new voting session
     */
    async createSession(dto: CreateSessionDto, user: any): Promise<Session> {
        // Enforce quota for managers
        if (user.role === UserRole.VOTE_MANAGER) {
            const fullUser = await this.usersService.findById(user.userId);
            const sessionCount = await this.sessionRepository.count({ where: { ownerId: user.userId } });

            if (sessionCount >= fullUser.maxSessions) {
                throw new ForbiddenException(`Session quota exceeded (${fullUser.maxSessions}). Contact admin.`);
            }
        }

        const accessCode = this.fingerService.generateAccessCode();

        // Set code expiration to 24 hours from now
        const codeExpiresAt = new Date();
        codeExpiresAt.setHours(codeExpiresAt.getHours() + 24);

        const session = this.sessionRepository.create({
            ...dto,
            accessCode,
            codeExpiresAt,
            status: 'pending',
            ownerId: user.userId,
        });

        return await this.sessionRepository.save(session);
    }

    /**
     * Get all sessions (Filtered by role)
     */
    async getAllSessions(user: any): Promise<Session[]> {
        this.logger.log(`[getAllSessions] User: ${user.username} (${user.role}), userId: ${user.userId}`);

        const where: any = {};
        if (user.role === UserRole.VOTE_MANAGER) {
            where.ownerId = user.userId;
            this.logger.log(`[getAllSessions] VOTE_MANAGER - Filtering by ownerId: ${user.userId}`);
        } else {
            this.logger.log(`[getAllSessions] SUPER_ADMIN - No filtering applied`);
        }

        const sessions = await this.sessionRepository.find({
            where,
            order: { createdAt: 'DESC' },
        });

        this.logger.log(`[getAllSessions] Found ${sessions.length} sessions`);
        sessions.forEach(s => this.logger.log(`  - Session: ${s.name} (ownerId: ${s.ownerId})`));

        return sessions;
    }

    /**
     * Get session by ID with agendas (Check ownership)
     */
    async getSessionWithAgendas(sessionId: string, user?: any): Promise<Session> {
        const session = await this.sessionRepository.findOne({
            where: { id: sessionId },
            relations: ['agendas'],
        });

        if (user && user.role === UserRole.VOTE_MANAGER && session.ownerId !== user.userId) {
            throw new ForbiddenException('Access denied to this session');
        }

        return session;
    }

    /**
     * Update session access code
     */
    async updateAccessCode(sessionId: string, user: any): Promise<Session> {
        const session = await this.getSessionWithAgendas(sessionId, user);

        session.accessCode = this.fingerService.generateAccessCode();
        session.codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        return await this.sessionRepository.save(session);
    }

    /**
     * Create a new agenda for a session
     */
    async createAgenda(dto: CreateAgendaDto, user: any): Promise<Agenda> {
        const session = await this.getSessionWithAgendas(dto.sessionId, user);

        // Quota check
        if (user.role === UserRole.VOTE_MANAGER) {
            const fullUser = await this.usersService.findById(user.userId);
            const agendaCount = await this.agendaRepository.count({ where: { sessionId: dto.sessionId } });

            if (agendaCount >= fullUser.maxAgendasPerSession) {
                throw new ForbiddenException(`Agenda quota exceeded (${fullUser.maxAgendasPerSession}).`);
            }
        }

        const agenda = this.agendaRepository.create(dto);
        return await this.agendaRepository.save(agenda);
    }

    /**
     * Get agenda by ID
     */
    async getAgendaWithSession(agendaId: string): Promise<Agenda> {
        return await this.agendaRepository.findOne({
            where: { id: agendaId },
        });
    }

    /**
     * Update agenda stage
     */
    async updateAgendaStage(
        agendaId: string,
        stage: 'pending' | 'submitted' | 'voting' | 'ended' | 'announced',
    ): Promise<Agenda> {
        const agenda = await this.agendaRepository.findOne({
            where: { id: agendaId },
        });

        agenda.stage = stage;

        if (stage === 'voting') {
            agenda.startedAt = new Date();
        } else if (stage === 'ended') {
            agenda.endedAt = new Date();
        }

        return await this.agendaRepository.save(agenda);
    }

    /**
     * Delete a session
     */
    async deleteSession(sessionId: string, user: any): Promise<void> {
        await this.getSessionWithAgendas(sessionId, user);
        await this.sessionRepository.delete(sessionId);
    }

    /**
     * Get agendas for a session
     */
    async getSessionAgendas(sessionId: string, user?: any): Promise<any[]> {
        await this.getSessionWithAgendas(sessionId, user);
        const agendas = await this.agendaRepository.find({
            where: { sessionId },
            order: { displayOrder: 'ASC', createdAt: 'ASC' },
            relations: ['votes'],
        });

        const totalParticipants = await this.sessionRepository.manager.getRepository('voters').count({
            where: { sessionId },
        });

        return agendas.map((agenda) => {
            const result: any = { ...agenda };

            if (agenda.stage === 'ended' || agenda.stage === 'announced') {
                const totalVotes = agenda.votes.length;
                const approveCount = agenda.votes.filter((v) => v.choice === '찬성').length;
                const rejectCount = agenda.votes.filter((v) => v.choice === '반대').length;
                const abstainCount = agenda.votes.filter((v) => v.choice === '기권').length;

                result.stats = {
                    totalVotes,
                    approveCount,
                    rejectCount,
                    abstainCount,
                    totalParticipants,
                    turnout: totalParticipants > 0 ? Math.round((totalVotes / totalParticipants) * 100) : 0
                };
            }

            // Remove raw votes to avoid payload bloat
            delete result.votes;
            return result;
        });
    }
    /**
     * Delete an agenda
     */
    async deleteAgenda(agendaId: string): Promise<void> {
        await this.agendaRepository.delete(agendaId);
    }
    async updateSessionLogo(sessionId: string, logoUrl: string): Promise<Session> {
        const session = await this.sessionRepository.findOne({
            where: { id: sessionId },
        });
        session.logoUrl = logoUrl;
        return this.sessionRepository.save(session);
    }

    async updateSessionSettings(
        sessionId: string,
        settings: {
            stadiumTheme?: string;
            voterTheme?: string;
            entryMode?: 'UNIQUE_QR' | 'GLOBAL_LINK';
            allowAnonymous?: boolean;
            strictDeviceCheck?: boolean;
        },
    ): Promise<Session> {
        const session = await this.sessionRepository.findOne({
            where: { id: sessionId },
        });

        if (settings.stadiumTheme) session.stadiumTheme = settings.stadiumTheme;
        if (settings.voterTheme) session.voterTheme = settings.voterTheme;
        if (settings.entryMode) session.entryMode = settings.entryMode;
        if (settings.hasOwnProperty('allowAnonymous')) session.allowAnonymous = settings.allowAnonymous;
        if (settings.hasOwnProperty('strictDeviceCheck')) session.strictDeviceCheck = settings.strictDeviceCheck;

        const updatedSession = await this.sessionRepository.save(session);

        // Broadcast settings update to all clients
        this.votingGateway.broadcastSettingsUpdate(sessionId, settings);

        return updatedSession;
    }

    async resetParticipants(sessionId: string): Promise<void> {
        await this.sessionRepository.manager.getRepository('voters').delete({ sessionId });
        this.votingGateway.notifyAuthRequired(sessionId);
    }

    async getParticipantCount(sessionId: string): Promise<number> {
        return await this.sessionRepository.manager.getRepository('voters').count({
            where: { sessionId },
        });
    }

    async exportSessionData(sessionId: string): Promise<string> {
        const agendas = await this.agendaRepository.find({
            where: { sessionId },
            relations: ['votes'],
            order: { displayOrder: 'ASC' },
        });

        const headers = ['Agenda Title', 'Choice', 'Voter ID', 'Voted At'];
        const rows = [headers.join(',')];

        for (const agenda of agendas) {
            for (const vote of agenda.votes) {
                rows.push([
                    `"${agenda.title.replace(/"/g, '""')}"`,
                    vote.choice,
                    vote.voterId,
                    vote.votedAt.toISOString()
                ].join(','));
            }
        }
        return rows.join('\n');
    }

    /**
     * Import voters from a list (name, phoneNumber)
     */
    async importVoters(sessionId: string, voterList: { name: string; phoneNumber: string }[], user: any): Promise<{ imported: number; failed: number }> {
        const session = await this.getSessionWithAgendas(sessionId, user);
        const owner = await this.usersService.findById(session.ownerId);

        let imported = 0;
        let failed = 0;

        for (const data of voterList) {
            try {
                // Check quota
                const currentCount = await this.voterRepository.count({ where: { sessionId } });
                if (owner && currentCount >= owner.maxVotersPerSession) {
                    failed++;
                    continue;
                }

                // Deduplication: check if phoneNumber already exists in this session
                if (data.phoneNumber) {
                    const existingVoter = await this.voterRepository.findOne({
                        where: { sessionId, phoneNumber: data.phoneNumber }
                    });
                    if (existingVoter) {
                        this.logger.warn(`Voter with phone ${data.phoneNumber} already exists in session ${sessionId}`);
                        failed++;
                        continue;
                    }
                }

                const voter = this.voterRepository.create({
                    sessionId,
                    name: data.name,
                    phoneNumber: data.phoneNumber,
                    accessCodeVerified: true, // Pre-verified if coming from SMS link
                });

                await this.voterRepository.save(voter);
                imported++;
            } catch (error) {
                failed++;
            }
        }

        return { imported, failed };
    }

    /**
     * Send unique voting links to all voters who have a phone number but haven't been sent the SMS yet
     */
    async sendSmsLinks(sessionId: string, user: any): Promise<{ sent: number; failed: number }> {
        const session = await this.getSessionWithAgendas(sessionId, user);
        const voters = await this.voterRepository.find({
            where: {
                sessionId,
                phoneNumber: Not(IsNull()),
                smsSentAt: IsNull()
            }
        });

        const baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3010';
        let sent = 0;
        let failed = 0;

        for (const voter of voters) {
            try {
                // Generate a one-time token for this voter
                // We'll reuse the existing Token entity mechanism
                const tokenRepo = this.sessionRepository.manager.getRepository(Token);
                const token = tokenRepo.create({
                    id: randomUUID(),
                    sessionId: session.id,
                    isUsed: false,
                    isRevoked: false,
                });
                await tokenRepo.save(token);

                // Link voter to token
                voter.tokenId = token.id;
                await this.voterRepository.save(voter);

                const votingUrl = `${baseUrl}/vote/${token.id}`;
                const response = await this.smsService.sendVotingLink(voter.phoneNumber, voter.name, votingUrl);

                if (response.success) {
                    voter.smsSentAt = new Date();
                    await this.voterRepository.save(voter);
                    sent++;
                } else {
                    failed++;
                }
            } catch (error) {
                failed++;
            }
        }

        return { sent, failed };
    }
}
