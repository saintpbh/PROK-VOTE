import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { VotingService } from './voting.service';
import { SessionService } from '../session/session.service';
import { AuthService } from '../auth/auth.service';
import { CastVoteDto } from './dto/voting.dto';

interface SocketWithVoter extends Socket {
    voterId?: string;
    sessionId?: string;
}

/**
 * WebSocket Gateway for real-time voting updates
 * Handles sub-second synchronization across all participants
 */
@WebSocketGateway({
    cors: {
        origin: (requestOrigin, callback) => {
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:3010',
                process.env.FRONTEND_URL,
                process.env.PRODUCTION_URL,
            ].filter(Boolean) as string[];

            if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    },
})
export class VotingGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private connectedUsers = new Map<string, SocketWithVoter>();
    private broadcastTimeouts = new Map<string, NodeJS.Timeout>();
    private pendingStats = new Map<string, any>();

    constructor(
        private votingService: VotingService,
        @Inject(forwardRef(() => SessionService))
        private sessionService: SessionService,
        @Inject(forwardRef(() => AuthService))
        private authService: AuthService,
    ) { }

    /**
     * Handle client connection
     */
    async handleConnection(client: SocketWithVoter) {
        try {
            const token = client.handshake.auth.token || client.handshake.query.token;

            if (token) {
                const payload = await this.authService.verifyAccessToken(token);
                client.voterId = payload.voterId;
                client.sessionId = payload.sessionId;

                // Attach user data to socket for later use
                (client as any).user = payload;

                console.log(`Client connected: ${client.id} (User: ${payload.sub || payload.voterId}, Role: ${payload.role})`);
            } else {
                console.log(`Client connected: ${client.id} (Anonymous/Display)`);
            }
        } catch (error) {
            console.log(`Client ${client.id} connection rejected: ${error.message}`);
            client.disconnect();
        }
    }


    /**
     * Handle client disconnection
     */
    async handleDisconnect(client: SocketWithVoter) {
        console.log(`Client disconnected: ${client.id}`);
        this.connectedUsers.delete(client.id);
    }

    /**
     * Join a session room
     * Clients join session-specific rooms for targeted broadcasts
     */
    @SubscribeMessage('join:session')
    async handleJoinSession(
        @ConnectedSocket() client: SocketWithVoter,
        @MessageBody() data: { sessionId: string; voterId?: string; role?: string },
    ) {
        const { sessionId, voterId, role } = data;
        const room = `session:${sessionId}`.toLowerCase();

        client.join(room);
        client.sessionId = sessionId;

        if (voterId) {
            client.voterId = voterId;
        }

        this.connectedUsers.set(client.id, client);

        console.log(`[Gateway] Client ${client.id} joined room: ${room} as ${role || 'voter'}`);

        return {
            success: true,
            message: `Joined session ${sessionId}`,
        };
    }

    /**
     * Helper to check if a user can control a session
     */
    private async canControlSession(user: any, sessionId: string): Promise<boolean> {
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        if (user.role === 'VOTE_MANAGER') {
            const session = await this.sessionService.getSessionWithAgendas(sessionId);
            return session && session.ownerId === user.userId;
        }
        return false;
    }

    /**
     * Admin: Update agenda stage
     * Broadcasts stage change to all participants instantly
     */
    @SubscribeMessage('stage:update')
    async handleStageUpdate(
        @ConnectedSocket() client: SocketWithVoter,
        @MessageBody() data: { agendaId: string; stage: string },
    ) {
        const user = (client as any).user;
        const { agendaId, stage } = data;

        // Get agenda to check session ownership
        const agenda = await this.sessionService.getAgendaWithSession(agendaId);
        if (!agenda) throw new WsException('Agenda not found');

        if (!(await this.canControlSession(user, agenda.sessionId))) {
            throw new WsException('Unauthorized: You do not own this session');
        }

        // Update stage in database
        const updatedAgenda = await this.sessionService.updateAgendaStage(
            agendaId,
            stage as any,
        );

        // Broadcast to all clients in the session
        const room = `session:${updatedAgenda.sessionId}`.toLowerCase();
        const clientCount = (await this.server.in(room).fetchSockets()).length;
        console.log(`[Gateway] Received stage:update for agenda ${agendaId} -> ${stage}. Broadcasting to room ${room} (Clients: ${clientCount})`);

        this.server.to(room).emit('stage:changed', {
            agendaId,
            stage,
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            agenda: updatedAgenda,
        };
    }

    /**
     * Voter: Cast vote
     * Updates statistics and broadcasts to moderators/admin
     */
    @SubscribeMessage('vote:cast')
    async handleVoteCast(
        @ConnectedSocket() client: SocketWithVoter,
        @MessageBody() data: CastVoteDto,
    ) {
        try {
            // Use voterId from authenticated socket for security (prevents spoofing)
            const voterId = client.voterId;
            if (!voterId) {
                throw new WsException('Unauthorized: Voter identity not verified');
            }

            // Save vote to database
            const vote = await this.votingService.castVote(voterId, data);

            // Get updated statistics
            const stats = await this.votingService.getAgendaStatistics(data.agendaId);

            // Emit to voter confirming vote
            client.emit('vote:confirmed', {
                success: true,
                vote: {
                    id: vote.id,
                    choice: vote.choice,
                    votedAt: vote.votedAt,
                },
            });

            // 4. Throttled broadcasting for scalability
            const agenda = await this.sessionService.getAgendaWithSession(data.agendaId);
            const room = `session:${agenda.sessionId}`.toLowerCase();

            // Store latest stats
            this.pendingStats.set(data.agendaId, stats);

            // Schedule broadcast if not already scheduled
            if (!this.broadcastTimeouts.has(data.agendaId)) {
                const timeout = setTimeout(() => {
                    const latestStats = this.pendingStats.get(data.agendaId);
                    if (latestStats) {
                        this.server.to(room).emit('stats:updated', latestStats);
                        console.log(`[Gateway] Throttled broadcast for agenda ${data.agendaId} to room ${room}`);
                    }
                    this.broadcastTimeouts.delete(data.agendaId);
                    this.pendingStats.delete(data.agendaId);
                }, 500); // 500ms debounce for high-frequency voting

                this.broadcastTimeouts.set(data.agendaId, timeout);
            }

            return {
                success: true,
                message: 'Vote cast successfully',
            };
        } catch (error) {
            client.emit('vote:error', {
                success: false,
                message: error.message,
            });

            return {
                success: false,
                message: error.message,
            };
        }
    }

    /**
     * Admin: End voting
     * Instantly disables all voter buttons via WebSocket broadcast
     */
    @SubscribeMessage('vote:end')
    async handleVoteEnd(
        @ConnectedSocket() client: SocketWithVoter,
        @MessageBody() data: { agendaId: string },
    ) {
        const user = (client as any).user;
        const { agendaId } = data;
        const agenda = await this.sessionService.getAgendaWithSession(agendaId);

        if (!agenda || !(await this.canControlSession(user, agenda.sessionId))) {
            throw new WsException('Unauthorized: Admin access required');
        }

        // Update agenda stage to 'ended'
        const updatedAgenda = await this.sessionService.updateAgendaStage(agendaId, 'ended');

        // Broadcast to all clients in the session
        const room = `session:${updatedAgenda.sessionId}`.toLowerCase();
        const clientCount = (await this.server.in(room).fetchSockets()).length;
        console.log(`[Gateway] Received vote:end for agenda ${agendaId}. Broadcasting to room ${room} (Clients: ${clientCount})`);

        this.server.to(room).emit('vote:ended', {
            agendaId,
            endedAt: updatedAgenda.endedAt,
        });

        // Also broadcast stage change for displays
        console.log(`[Gateway] Broadcasting stage:changed (ended) to room ${room}`);
        this.server.to(room).emit('stage:changed', {
            agendaId,
            stage: 'ended',
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            message: 'Voting ended successfully',
        };
    }

    /**
     * Admin/Moderator: Publish results
     * Triggers result animation on stadium display
     */
    @SubscribeMessage('result:publish')
    async handleResultPublish(
        @ConnectedSocket() client: SocketWithVoter,
        @MessageBody() data: { agendaId: string },
    ) {
        const user = (client as any).user;
        const { agendaId } = data;
        const agenda = await this.sessionService.getAgendaWithSession(agendaId);

        if (!agenda || !(await this.canControlSession(user, agenda.sessionId))) {
            throw new WsException('Unauthorized: Admin access required');
        }

        // Execute DB operations in parallel to minimize latency
        const [stats, updatedAgenda] = await Promise.all([
            this.votingService.getAgendaStatistics(agendaId),
            this.sessionService.updateAgendaStage(agendaId, 'announced')
        ]);

        // Broadcast results to session room
        const room = `session:${updatedAgenda.sessionId}`.toLowerCase();
        const clientCount = (await this.server.in(room).fetchSockets()).length;
        console.log(`[Gateway] Received result:publish for agenda ${agendaId}. Broadcasting to room ${room} (Clients: ${clientCount})`);

        this.server.to(room).emit('result:published', {
            agendaId,
            stats,
            announcedAt: new Date().toISOString(),
        });

        return {
            success: true,
            stats,
        };
    }

    /**
     * Request current statistics
     */
    @SubscribeMessage('stats:request')
    async handleStatsRequest(
        @ConnectedSocket() client: SocketWithVoter,
        @MessageBody() data: { agendaId: string },
    ) {
        const stats = await this.votingService.getAgendaStatistics(data.agendaId);

        client.emit('stats:response', stats);

        return stats;
    }

    /**
     * Admin: Revoke tokens (for important vote mode)
     */
    @SubscribeMessage('tokens:revoke')
    async handleTokenRevoke(
        @ConnectedSocket() client: SocketWithVoter,
        @MessageBody() data: { sessionId: string },
    ) {
        const user = (client as any).user;
        if (!(await this.canControlSession(user, data.sessionId))) {
            throw new WsException('Unauthorized: Admin access required');
        }

        // This would trigger token revocation in the database
        // For now, just broadcast re-auth requirement
        this.server.to(`session:${data.sessionId}`.toLowerCase()).emit('auth:required', {
            message: 'Re-authentication required for important vote',
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            message: 'Token revocation broadcast sent',
        };
    }
    /**
     * Admin: Control stadium display (reset, show logo)
     */
    @SubscribeMessage('stadium:control')
    async handleStadiumControl(
        @ConnectedSocket() client: SocketWithVoter,
        @MessageBody() data: { sessionId: string; action: 'reset' | 'show_logo' },
    ) {
        const user = (client as any).user;
        if (!(await this.canControlSession(user, data.sessionId))) {
            throw new WsException('Unauthorized: Admin access required');
        }

        const { sessionId, action } = data;
        const room = `session:${sessionId}`.toLowerCase();

        console.log(`[Gateway] Broadcasting stadium:control (${action}) to room ${room}`);

        this.server.to(room).emit('stadium:control', {
            action,
            timestamp: new Date().toISOString(),
        });

        return { success: true };
    }

    /**
     * Broadcast auth required event to session
     * Used when participants are reset
     */
    /**
     * Broadcast session settings update (e.g. theme changes)
     */
    broadcastSettingsUpdate(sessionId: string, settings: any) {
        const room = `session:${sessionId}`.toLowerCase();
        console.log(`[Gateway] Broadcasting session:settings:update to room ${room}`, settings);
        this.server.to(room).emit('session:settings:update', settings);
    }

    /**
     * Broadcast stadium-specific controls
     */
    broadcastStadiumControl(sessionId: string, action: string, data?: any) {
        const room = `session:${sessionId}`.toLowerCase();
        console.log(`[Gateway] Broadcasting stadium:control (${action}) to room ${room}`);
        this.server.to(room).emit('stadium:control', { action, ...data });
    }

    notifyAuthRequired(sessionId: string) {
        this.server.to(`session:${sessionId}`.toLowerCase()).emit('auth:required', {
            message: 'Participants reset by admin',
            timestamp: new Date().toISOString(),
        });
    }
}
