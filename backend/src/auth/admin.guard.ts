import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

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

            if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'VOTE_MANAGER') {
                console.log(`🚫 AdminGuard: Insufficient permissions for user ${payload.username} (role: ${payload.role})`);
                throw new UnauthorizedException('Insufficient permissions');
            }

            // Attach user to request for use in controllers
            request.user = payload;
            return true;
        } catch (error) {
            console.log(`🚫 AdminGuard: Token verification failed: ${error.message}`);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
