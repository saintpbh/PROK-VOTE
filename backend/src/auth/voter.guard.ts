import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Voter } from '../entities/voter.entity';

@Injectable()
export class VoterGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        @InjectRepository(Voter)
        private voterRepository: Repository<Voter>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedException('Authorization header missing');
        }

        const [type, token] = authHeader.split(' ');

        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException('Invalid token format');
        }

        try {
            const payload = await this.jwtService.verifyAsync(token);

            // Check if this is a voter token (has voterId)
            if (!payload.voterId) {
                throw new UnauthorizedException('Not a voter token');
            }

            // Verify voter exists in database
            const voter = await this.voterRepository.findOne({
                where: { id: payload.voterId },
            });

            if (!voter) {
                throw new UnauthorizedException('Voter record not found');
            }

            // Attach voter to request
            request.user = payload;
            request.voter = voter;

            return true;
        } catch (error) {
            throw new UnauthorizedException(error.message || 'Invalid or expired token');
        }
    }
}
