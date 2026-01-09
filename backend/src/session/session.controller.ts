import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Param,
    Body,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
    UseGuards,
    Res,
    Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SessionService } from './session.service';
import { CreateSessionDto, CreateAgendaDto, UpdateAgendaStageDto, UpdateSessionSettingsDto } from './dto/session.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller('sessions')
export class SessionController {
    constructor(private sessionService: SessionService) { }

    /**
     * Create a new session
     * POST /sessions
     */
    @Post()
    @UseGuards(AdminGuard)
    async createSession(@Body() dto: CreateSessionDto, @Req() req: any) {
        const session = await this.sessionService.createSession(dto, req.user);
        return {
            success: true,
            session,
        };
    }

    /**
     * Get all sessions
     * GET /sessions
     */
    @Get()
    @UseGuards(AdminGuard)
    async getAllSessions(@Req() req: any) {
        const sessions = await this.sessionService.getAllSessions(req.user);
        return {
            success: true,
            sessions,
        };
    }

    /**
     * Get session with agendas
     * GET /sessions/:id
     */
    @Get(':id')
    async getSession(@Param('id') id: string, @Req() req: any) {
        const session = await this.sessionService.getSessionWithAgendas(id, req.user);
        return {
            success: true,
            session,
        };
    }
    /**
     * Get session basics (Publicly accessible for joining)
     * GET /sessions/public/:id
     */
    @Get('public/:id')
    async getPublicSession(@Param('id') id: string) {
        const session = await this.sessionService.getSessionWithAgendas(id);
        if (!session) {
            return { success: false, message: 'Session not found' };
        }
        return {
            success: true,
            session: {
                id: session.id,
                name: session.name,
                entryMode: session.entryMode,
                voterTheme: session.voterTheme,
                gpsEnabled: session.gpsEnabled,
                gpsRadius: session.gpsRadius,
                gpsLat: session.gpsLat,
                gpsLng: session.gpsLng,
                logoUrl: session.logoUrl,
            },
        };
    }

    /**
     * Delete a session
     * DELETE /sessions/:id
     */
    @Delete(':id')
    @UseGuards(AdminGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteSession(@Param('id') id: string, @Req() req: any) {
        await this.sessionService.deleteSession(id, req.user);
        return;
    }

    /**
     * Update access code
     * PUT /sessions/:id/access-code
     */
    @Put(':id/access-code')
    @UseGuards(AdminGuard)
    @HttpCode(HttpStatus.OK)
    async updateAccessCode(@Param('id') id: string, @Req() req: any) {
        const session = await this.sessionService.updateAccessCode(id, req.user);
        return {
            success: true,
            accessCode: session.accessCode,
            expiresAt: session.codeExpiresAt,
        };
    }

    /**
     * Create agenda
     * POST /sessions/agendas
     */
    @Post('agendas')
    @UseGuards(AdminGuard)
    async createAgenda(@Body() dto: CreateAgendaDto, @Req() req: any) {
        const agenda = await this.sessionService.createAgenda(dto, req.user);
        return {
            success: true,
            agenda,
        };
    }

    /**
     * Get session agendas
     * GET /sessions/:id/agendas
     */
    @Get(':id/agendas')
    async getAgendas(@Param('id') id: string, @Req() req: any) {
        const agendas = await this.sessionService.getSessionAgendas(id, req.user);
        return {
            success: true,
            agendas,
        };
    }

    /**
     * Update agenda stage
     * PUT /sessions/agendas/:id/stage
     */
    @Put('agendas/:id/stage')
    @UseGuards(AdminGuard)
    @HttpCode(HttpStatus.OK)
    async updateAgendaStage(
        @Param('id') id: string,
        @Body() dto: UpdateAgendaStageDto,
    ) {
        const agenda = await this.sessionService.updateAgendaStage(id, dto.stage);
        return {
            success: true,
            agenda,
        };
    }

    /**
     * Delete an agenda
     * DELETE /sessions/agendas/:id
     */
    @Delete('agendas/:id')
    @UseGuards(AdminGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteAgenda(@Param('id') id: string) {
        await this.sessionService.deleteAgenda(id);
        return;
    }

    /**
     * Upload session logo
     * POST /sessions/:id/logo
     */
    @Post(':id/logo')
    @UseGuards(AdminGuard)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                return cb(null, `${randomName}${extname(file.originalname)}`);
            }
        })
    }))
    async uploadLogo(@Param('id') id: string, @UploadedFile() file: any) {
        const logoUrl = `/uploads/${file.filename}`;
        await this.sessionService.updateSessionLogo(id, logoUrl);
        return {
            success: true,
            logoUrl
        };
    }

    /**
     * Reset participants for a session
     * POST /sessions/:id/reset-participants
     */
    @Post(':id/reset-participants')
    @UseGuards(AdminGuard)
    @HttpCode(HttpStatus.OK)
    async resetParticipants(@Param('id') id: string) {
        await this.sessionService.resetParticipants(id);
        return {
            success: true,
        };
    }

    /**
     * Get participant count for a session
     * GET /sessions/:id/participants/count
     */
    @Get(':id/participants/count')
    async getParticipantCount(@Param('id') id: string) {
        const count = await this.sessionService.getParticipantCount(id);
        return {
            success: true,
            count,
        };
    }

    /**
     * Update session settings (themes, etc.)
     * PUT /sessions/:id/settings
     */
    @Put(':id/settings')
    @UseGuards(AdminGuard)
    @HttpCode(HttpStatus.OK)
    async updateSettings(
        @Param('id') id: string,
        @Body() dto: UpdateSessionSettingsDto,
    ) {
        const session = await this.sessionService.updateSessionSettings(id, dto);
        return {
            success: true,
            session,
        };
    }

    /**
     * Export session data
     * GET /sessions/:id/export
     */
    @Get(':id/export')
    @UseGuards(AdminGuard)
    async exportSession(@Param('id') id: string, @Res() res: Response) {
        const csv = await this.sessionService.exportSessionData(id);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="session_${id}.csv"`);
        res.send(csv);
    }

    /**
     * Import voters from list
     * POST /sessions/:id/voters/import
     */
    @Post(':id/voters/import')
    @UseGuards(AdminGuard)
    async importVoters(
        @Param('id') id: string,
        @Body() body: { voters: { name: string; phoneNumber: string }[] },
        @Req() req: any
    ) {
        const result = await this.sessionService.importVoters(id, body.voters, req.user);
        return {
            success: true,
            ...result
        };
    }

    /**
     * Send voting links via SMS
     * POST /sessions/:id/voters/send-sms
     */
    @Post(':id/voters/send-sms')
    @UseGuards(AdminGuard)
    async sendSmsLinks(
        @Param('id') id: string,
        @Req() req: any
    ) {
        const result = await this.sessionService.sendSmsLinks(id, req.user);
        return {
            success: true,
            ...result
        };
    }
}
