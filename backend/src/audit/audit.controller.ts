import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AdminGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('audit')
@UseGuards(AdminGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    async getLogs(
        @Query('sessionId') sessionId?: string,
        @Query('eventType') eventType?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 50,
    ) {
        return await this.auditService.findAll({ sessionId, eventType, page, limit });
    }
}
