import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vote, Voter, Agenda } from '../entities';
import { AuditService } from '../audit/audit.service';
import { CastVoteDto } from './dto/voting.dto';

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
    constructor(
        @InjectRepository(Vote)
        private voteRepository: Repository<Vote>,
        @InjectRepository(Voter)
        private voterRepository: Repository<Voter>,
        @InjectRepository(Agenda)
        private agendaRepository: Repository<Agenda>,
        private auditService: AuditService,
    ) { }

    /**
     * Cast a vote
     */
    async castVote(voterId: string, dto: CastVoteDto): Promise<Vote> {
        // Check if voter exists
        const voter = await this.voterRepository.findOne({
            where: { id: voterId },
        });

        if (!voter) {
            throw new BadRequestException('Voter not found');
        }

        // Check if agenda exists and is in voting stage
        const agenda = await this.agendaRepository.findOne({
            where: { id: dto.agendaId },
        });

        if (!agenda) {
            throw new BadRequestException('Agenda not found');
        }

        if (agenda.stage !== 'voting') {
            throw new BadRequestException('Voting is not active for this agenda');
        }

        // Check if voter already voted
        const existingVote = await this.voteRepository.findOne({
            where: { voterId, agendaId: dto.agendaId },
        });

        if (existingVote) {
            throw new BadRequestException('You have already voted on this agenda');
        }

        // Create and save vote
        const vote = this.voteRepository.create({
            voterId,
            agendaId: dto.agendaId,
            choice: dto.choice,
        });

        const savedVote = await this.voteRepository.save(vote);

        await this.auditService.log({
            eventType: 'VOTER_VOTE_CAST',
            sessionId: agenda.sessionId,
            voterId: voterId,
            eventData: { agendaId: agenda.id, choice: dto.choice, voteId: savedVote.id }
        });

        return savedVote;
    }

    /**
     * Get voting statistics for an agenda
     */
    async getAgendaStatistics(agendaId: string): Promise<VoteStatistics> {
        const agenda = await this.agendaRepository.findOne({
            where: { id: agendaId },
            relations: ['session'],
        });

        if (!agenda) {
            throw new BadRequestException('Agenda not found');
        }

        // Get all votes for this agenda
        const votes = await this.voteRepository.find({
            where: { agendaId },
        });

        // Get total participants in session
        const totalParticipants = await this.voterRepository.count({
            where: { sessionId: agenda.sessionId },
        });

        // Calculate generic vote counts
        const voteCounts: Record<string, number> = {};
        votes.forEach((v) => {
            voteCounts[v.choice] = (voteCounts[v.choice] || 0) + 1;
        });

        const approveCount = voteCounts['찬성'] || 0;
        const rejectCount = voteCounts['반대'] || 0;
        const abstainCount = voteCounts['기권'] || 0;

        return {
            agendaId: agenda.id,
            title: agenda.title,
            type: agenda.type,
            options: agenda.options || [],
            totalVotes: votes.length,
            approveCount,
            rejectCount,
            abstainCount,
            voteCounts,
            turnoutPercentage:
                totalParticipants > 0
                    ? Math.round((votes.length / totalParticipants) * 100 * 100) / 100
                    : 0,
            totalParticipants,
        };
    }

    /**
     * Check if voter has voted on an agenda
     */
    async hasVoted(voterId: string, agendaId: string): Promise<boolean> {
        const vote = await this.voteRepository.findOne({
            where: { voterId, agendaId },
        });

        return !!vote;
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
