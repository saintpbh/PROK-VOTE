import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vote, Voter, Agenda } from '../entities';
import { AuditService } from '../audit/audit.service';
import { CastVoteDto } from './dto/voting.dto';
import { VotingGateway } from './voting.gateway';

export interface VoteStatistics {
    agendaId: string;
    title: string;
    type: string;
    options: string[];
    totalVotes: number;
    approveCount: number;
    rejectCount: number;
    abstainCount: number;
    voteCounts: Record<string, number>;
    turnoutPercentage: number;
    totalParticipants: number;
}

@Injectable()
export class VotingService {
    // ── In-memory vote counters for instant statistics ──
    // agendaId → { choice → count }
    // Why: avoids DB round-trip on every broadcast; stays in sync via castVote()
    private voteCounters = new Map<string, Map<string, number>>();
    // agendaId → total vote count
    private voteTotals = new Map<string, number>();

    constructor(
        @InjectRepository(Vote)
        private voteRepository: Repository<Vote>,
        @InjectRepository(Voter)
        private voterRepository: Repository<Voter>,
        @InjectRepository(Agenda)
        private agendaRepository: Repository<Agenda>,
        private auditService: AuditService,
        @Inject(forwardRef(() => VotingGateway))
        private votingGateway: VotingGateway,
    ) { }

    /**
     * Cast a vote — FAST PATH
     * Zero pre-validation SELECTs: relies on DB constraints (FK + UNIQUE) for integrity.
     * This reduces DB queries from 4 to 1 per vote under burst load.
     */
    async castVote(voterId: string, dto: CastVoteDto): Promise<Vote> {
        const vote = this.voteRepository.create({
            voterId,
            agendaId: dto.agendaId,
            choice: dto.choice,
        });

        let savedVote: Vote;
        try {
            savedVote = await this.voteRepository.save(vote);
        } catch (error: any) {
            // PostgreSQL unique violation (23505) — voter already voted
            if (error.code === '23505') {
                throw new BadRequestException('이미 투표하셨습니다.');
            }
            // PostgreSQL FK violation (23503) — invalid voter or agenda ID
            if (error.code === '23503') {
                throw new BadRequestException('유효하지 않은 투표 대상입니다.');
            }
            throw error;
        }

        // Update in-memory counter (instant, no DB)
        this.incrementVoteCounter(dto.agendaId, dto.choice);

        // Audit log — fire-and-forget (non-blocking)
        setImmediate(() => {
            this.auditService.log({
                eventType: 'VOTER_VOTE_CAST',
                voterId: voterId,
                eventData: { agendaId: dto.agendaId, choice: dto.choice, voteId: savedVote.id }
            }).catch(e => console.warn('[VotingService] Audit log failed:', e.message));
        });

        return savedVote;
    }

    // ── In-memory counter management ──

    /**
     * Increment the in-memory vote counter for a given agenda + choice.
     */
    private incrementVoteCounter(agendaId: string, choice: string) {
        if (!this.voteCounters.has(agendaId)) {
            this.voteCounters.set(agendaId, new Map());
            this.voteTotals.set(agendaId, 0);
        }
        const counter = this.voteCounters.get(agendaId)!;
        counter.set(choice, (counter.get(choice) || 0) + 1);
        this.voteTotals.set(agendaId, (this.voteTotals.get(agendaId) || 0) + 1);
    }

    /**
     * Get in-memory vote counts for instant broadcast (no DB query).
     */
    getInMemoryVoteCounts(agendaId: string): { voteCounts: Record<string, number>; totalVotes: number } | null {
        const counter = this.voteCounters.get(agendaId);
        if (!counter) return null;

        const voteCounts: Record<string, number> = {};
        counter.forEach((count, choice) => { voteCounts[choice] = count; });

        return {
            voteCounts,
            totalVotes: this.voteTotals.get(agendaId) || 0,
        };
    }

    /**
     * Sync in-memory counters from DB (on startup or when counters may be stale).
     */
    async syncVoteCountersFromDB(agendaId: string): Promise<void> {
        const rows = await this.voteRepository
            .createQueryBuilder('v')
            .select('v.choice', 'choice')
            .addSelect('COUNT(*)::int', 'count')
            .where('v.agendaId = :agendaId', { agendaId })
            .groupBy('v.choice')
            .getRawMany();

        const counter = new Map<string, number>();
        let total = 0;
        for (const row of rows) {
            counter.set(row.choice, parseInt(row.count, 10));
            total += parseInt(row.count, 10);
        }
        this.voteCounters.set(agendaId, counter);
        this.voteTotals.set(agendaId, total);
    }

    /**
     * Clear in-memory counters for an agenda (e.g., when agenda is reset).
     */
    clearVoteCounter(agendaId: string) {
        this.voteCounters.delete(agendaId);
        this.voteTotals.delete(agendaId);
    }

    /**
     * Get voting statistics for an agenda.
     * Uses in-memory counters for real-time; falls back to DB COUNT query.
     */
    async getAgendaStatistics(agendaId: string): Promise<VoteStatistics> {
        const agenda = await this.agendaRepository.findOne({
            where: { id: agendaId },
            relations: ['session'],
        });

        if (!agenda) {
            throw new BadRequestException('Agenda not found');
        }

        // Try in-memory first (instant, no DB query)
        let voteCounts: Record<string, number>;
        let totalVotes: number;

        const inMemory = this.getInMemoryVoteCounts(agendaId);
        if (inMemory) {
            voteCounts = inMemory.voteCounts;
            totalVotes = inMemory.totalVotes;
        } else {
            // Fallback: SQL COUNT query (much faster than SELECT * + JS count)
            const rows = await this.voteRepository
                .createQueryBuilder('v')
                .select('v.choice', 'choice')
                .addSelect('COUNT(*)::int', 'count')
                .where('v.agendaId = :agendaId', { agendaId })
                .groupBy('v.choice')
                .getRawMany();

            voteCounts = {};
            totalVotes = 0;
            for (const row of rows) {
                voteCounts[row.choice] = parseInt(row.count, 10);
                totalVotes += parseInt(row.count, 10);
            }
            // Warm up the in-memory cache
            const counter = new Map<string, number>();
            for (const [k, v] of Object.entries(voteCounts)) counter.set(k, v);
            this.voteCounters.set(agendaId, counter);
            this.voteTotals.set(agendaId, totalVotes);
        }

        // Online participants (O(1) via sessionVoterSets)
        const onlineCount = this.votingGateway ? this.votingGateway.getOnlineVoterCount(agenda.sessionId) : 0;
        const totalParticipants = Math.max(onlineCount, totalVotes);

        const approveCount = voteCounts['찬성'] || 0;
        const rejectCount = voteCounts['반대'] || 0;
        const abstainCount = voteCounts['기권'] || 0;

        return {
            agendaId: agenda.id,
            title: agenda.title,
            type: agenda.type,
            options: agenda.options || [],
            totalVotes,
            approveCount,
            rejectCount,
            abstainCount,
            voteCounts,
            turnoutPercentage:
                totalParticipants > 0
                    ? Math.round((totalVotes / totalParticipants) * 100 * 100) / 100
                    : 0,
            totalParticipants,
        };
    }

    /**
     * Check if voter has voted on an agenda
     */
    async hasVoted(voterId: string, agendaId: string): Promise<boolean> {
        const count = await this.voteRepository.count({
            where: { voterId, agendaId },
        });
        return count > 0;
    }

    /**
     * Get voter's vote for an agenda
     */
    async getVoterVote(voterId: string, agendaId: string): Promise<Vote | null> {
        return await this.voteRepository.findOne({
            where: { voterId, agendaId },
        });
    }
}

