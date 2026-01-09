import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
    UnauthorizedException,
} from '@nestjs/common';
import { VotingService } from './voting.service';
import { CastVoteDto } from './dto/voting.dto';
import { VoterGuard } from '../auth/voter.guard';

@Controller('votes')
export class VotingController {
    constructor(private votingService: VotingService) { }

    /**
     * Cast a vote
     * POST /votes
     */
    @Post()
    @UseGuards(VoterGuard)
    @HttpCode(HttpStatus.CREATED)
    async castVote(
        @Req() req: any,
        @Body() dto: CastVoteDto,
    ) {
        // Use voterId from JWT for security (prevents spoofing)
        const voterId = req.user.voterId;
        const vote = await this.votingService.castVote(voterId, dto);

        return {
            success: true,
            vote,
        };
    }

    /**
     * Get voting statistics for an agenda
     * GET /votes/stats/:agendaId
     */
    @Get('stats/:agendaId')
    async getStatistics(@Param('agendaId') agendaId: string) {
        const stats = await this.votingService.getAgendaStatistics(agendaId);

        return {
            success: true,
            stats,
        };
    }

    /**
     * Check if voter has voted
     * GET /votes/check/:voterId/:agendaId
     */
    @Get('check/:voterId/:agendaId')
    @UseGuards(VoterGuard)
    async checkVoted(
        @Req() req: any,
        @Param('voterId') voterId: string,
        @Param('agendaId') agendaId: string,
    ) {
        // Safety check: Only allow checking own status
        if (voterId !== req.user.voterId) {
            throw new UnauthorizedException('You can only check your own voting status');
        }

        const hasVoted = await this.votingService.hasVoted(voterId, agendaId);

        return {
            success: true,
            hasVoted,
        };
    }

    /**
     * Get voter's vote
     * GET /votes/:voterId/:agendaId
     */
    @Get(':voterId/:agendaId')
    @UseGuards(VoterGuard)
    async getVote(
        @Req() req: any,
        @Param('voterId') voterId: string,
        @Param('agendaId') agendaId: string,
    ) {
        // Safety check: Only allow getting own vote
        if (voterId !== req.user.voterId) {
            throw new UnauthorizedException('You can only view your own votes');
        }

        const vote = await this.votingService.getVoterVote(voterId, agendaId);

        return {
            success: true,
            vote,
        };
    }
}
