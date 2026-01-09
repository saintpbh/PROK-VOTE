import { Controller, Get, Post, Body, Param, Put, UseGuards, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../entities/user.entity';

@Controller('users')
@UseGuards(AdminGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('managers')
    async getManagers() {
        const managers = await this.usersService.findAllManagers();
        return {
            success: true,
            managers,
        };
    }

    @Post('managers')
    async createManager(@Body() body: any) {
        const { username, password, maxSessions, maxAgendasPerSession, maxVotersPerSession } = body;
        const user = await this.usersService.createUser(
            username,
            password,
            UserRole.VOTE_MANAGER,
            { maxSessions, maxAgendasPerSession, maxVotersPerSession }
        );
        return {
            success: true,
            user,
        };
    }

    @Put('managers/:id/quotas')
    async updateQuotas(@Param('id') id: string, @Body() body: any) {
        const user = await this.usersService.updateUserQuotas(id, body);
        return {
            success: true,
            user,
        };
    }

    @Put('managers/:id/status')
    async setStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
        const user = await this.usersService.setAccountStatus(id, body.isActive);
        return {
            success: true,
            user,
        };
    }
}
