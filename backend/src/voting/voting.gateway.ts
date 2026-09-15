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
import { AuditService } from '../audit/audit.service';
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
                process.env.FRONTEND_URL,
                process.env.PRODUCTION_URL,
                process.env.CUSTOM_DOMAIN_URL,
            ].filter(Boolean) as string[];

            const cleanOrigin = requestOrigin?.replace(/\/$/, '');
            const cleanAllowed = allowedOrigins.map(o => o.replace(/\/$/, ''));

            console.log(`[Socket CORS] Origin: ${requestOrigin} (Clean: ${cleanOrigin}), Allowed: ${cleanAllowed.join(', ')}`);

            const isLocalNetwork = cleanOrigin && (
                cleanOrigin.startsWith('http://192.168.') ||
                cleanOrigin.startsWith('http://10.') ||
                cleanOrigin.startsWith('http://172.') ||
                cleanOrigin.startsWith('http://localhost')
            );

            if (!requestOrigin || cleanAllowed.includes(cleanOrigin) || isLocalNetwork) {
                callback(null, true);
            } else {
                console.warn(`[Socket CORS] REJECTED: ${requestOrigin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    },
    // POLLING ONLY: Cloud Run max 1000 concurrent/instance. WebSocket = persistent = 2000 users exceed limit.
    // Polling = short-lived requests (~100ms) → 2000 users safely within limit.
    transports: ['polling'],
    allowUpgrades: false,
    pingTimeout: 30000,        // 60s → 30s: faster zombie socket detection under 2000 users
    pingInterval: 15000,       // 25s → 15s: more frequent heartbeat for cellular networks
    connectTimeout: 10000,     // 10s connection timeout
    maxHttpBufferSize: 1e6,    // 1MB max message size
})
export class VotingGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private connectedUsers = new Map<string, SocketWithVoter>();
    private broadcastTimeouts = new Map<string, NodeJS.Timeout>();
    private pendingStats = new Map<string, any>();

    // ── O(1) online voter counting ──
    // sessionId → Set<voterId> — avoids O(n) Map iteration on every count request
    private sessionVoterSets = new Map<string, Set<string>>();
    // sessionId → timestamp when access code was changed (for force-reauth via polling)
    private forceReauthAt = new Map<string, number>();

    constructor(
        private votingService: VotingService,
        @Inject(forwardRef(() => SessionService))
        private sessionService: SessionService,
        @Inject(forwardRef(() => AuthService))
        private authService: AuthService,
        private auditService: AuditService,
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
                (client as any).role = payload.role || 'voter';
                (client as any).user = payload;
                this.connectedUsers.set(client.id, client);

                // Track voter in O(1) session set
                if (payload.sessionId && payload.voterId) {
                    this.addVoterToSession(payload.sessionId, payload.voterId);
                }

                // Audit log — fire-and-forget (non-blocking during 2000 user connection storms)
                setImmediate(() => {
                    this.auditService.log({
                        eventType: 'VOTER_CONNECTED',
                        sessionId: payload.sessionId,
                        voterId: payload.voterId,
                        eventData: { socketId: client.id },
                        req: {
                            headers: client.handshake.headers,
                            socket: client.conn.remoteAddress ? { remoteAddress: client.conn.remoteAddress } : client.handshake.address
                        } as any
                    }).catch(e => console.warn('[Gateway] Connect audit failed:', e.message));
                });

                console.log(`[Gateway] Client ${client.id} AUTHENTICATED (Voter: ${payload.voterId}, Session: ${payload.sessionId})`);
            } else {
                console.log(`[Gateway] Client ${client.id} connected (Anonymous/Display)`);
            }
        } catch (error) {
            console.warn(`[Gateway] Client ${client.id} AUTH FAILED: ${error.message} — allowing anonymous connection`);
            client.emit('auth:required', { reason: error.message });
        }
    }


    /**
     * Handle client disconnection
     */
    async handleDisconnect(client: SocketWithVoter) {
        const sessionId = client.sessionId;
        const voterId = client.voterId;

        this.connectedUsers.delete(client.id);

        // Remove voter from O(1) session set (only if no other sockets for this voter)
        if (voterId && sessionId) {
            this.removeVoterFromSessionIfLast(sessionId, voterId, client.id);

            // Audit log — fire-and-forget
            setImmediate(() => {
                this.auditService.log({
                    eventType: 'VOTER_DISCONNECTED',
                    sessionId,
                    voterId,
                    eventData: { socketId: client.id },
                    req: {
                        headers: client.handshake?.headers,
                        socket: client.conn?.remoteAddress ? { remoteAddress: client.conn.remoteAddress } : client.handshake?.address
                    } as any
                }).catch(() => {});
            });
        }

        // Broadcast updated online count
        if (sessionId) {
            this.debouncedBroadcastParticipantCount(sessionId);
        }
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

        if (role) {
            (client as any).role = role;
        }

        this.connectedUsers.set(client.id, client);

        // Track voter in O(1) session set
        if (voterId) {
            this.addVoterToSession(sessionId, voterId);
        }

        const onlineCount = this.getOnlineVoterCount(sessionId);
        console.log(`[Gateway] Client ${client.id} joined room: ${room} as ${role || 'voter'}. Online voters: ${onlineCount}`);

        // Broadcast updated participant count to the entire room (for stadium display)
        await this.broadcastParticipantCount(sessionId);

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
     * FAST PATH: DB insert → immediate confirmation → background audit/stats
     * Target: <20ms response time under burst load
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

            // ── CRITICAL PATH (synchronous, ~20ms) ──
            // Only the vote INSERT is blocking — everything else is deferred
            const vote = await this.votingService.castVote(voterId, data);

            // Emit confirmation IMMEDIATELY — don't wait for audit/stats
            client.emit('vote:confirmed', {
                success: true,
                vote: {
                    id: vote.id,
                    choice: vote.choice,
                    votedAt: vote.votedAt,
                },
            });

            // ── BACKGROUND PATH (fire-and-forget, non-blocking) ──
            // Why setImmediate: allows the event loop to process the next incoming
            // vote:cast before running audit/stats queries, preventing queue buildup
            // during burst voting (1000 users within 5 seconds)
            const sessionId = client.sessionId;
            const agendaId = data.agendaId;
            const choice = data.choice;
            const voteId = vote.id;
            const clientId = client.id;
            const handshakeHeaders = client.handshake?.headers;
            const remoteAddress = client.conn?.remoteAddress || client.handshake?.address;
            const deviceFingerprint = client.handshake?.auth?.deviceFingerprint || clientId;
            const voterName = (client as any).user?.voterName || undefined;

            setImmediate(async () => {
                try {
                    // Audit log (non-critical, fire-and-forget)
                    await this.auditService.log({
                        eventType: 'VOTE_CAST',
                        sessionId,
                        voterId,
                        eventData: { agendaId, choice, voteId },
                        req: {
                            headers: handshakeHeaders,
                            socket: remoteAddress ? { remoteAddress } : undefined
                        } as any
                    });

                    // Granular vote log for per-agenda audit trail
                    const agendaForLog = await this.sessionService.getAgendaWithSession(agendaId);
                    if (agendaForLog) {
                        await this.sessionService.createVoteLog({
                            sessionId: agendaForLog.sessionId,
                            agendaId,
                            agendaTitle: agendaForLog.title,
                            voterBrowserId: deviceFingerprint,
                            voterName,
                            choice,
                        });
                    }

                    // Get updated statistics and schedule throttled broadcast
                    const stats = await this.votingService.getAgendaStatistics(agendaId);
                    const agenda = agendaForLog || await this.sessionService.getAgendaWithSession(agendaId);
                    if (agenda) {
                        const room = `session:${agenda.sessionId}`.toLowerCase();
                        this.pendingStats.set(agendaId, stats);

                        if (!this.broadcastTimeouts.has(agendaId)) {
                            const timeout = setTimeout(() => {
                                const latestStats = this.pendingStats.get(agendaId);
                                if (latestStats) {
                                    this.server.to(room).emit('stats:updated', latestStats);
                                }
                                this.broadcastTimeouts.delete(agendaId);
                                this.pendingStats.delete(agendaId);
                            }, 500);
                            this.broadcastTimeouts.set(agendaId, timeout);
                        }
                    }
                } catch (bgError) {
                    // Background failures must not crash the process
                    console.error(`[Gateway] Background vote processing error for agenda ${agendaId}:`, bgError.message);
                }
            });

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

        // Automatically reset stadium display to initial screen when vote ends
        console.log(`[Gateway] Broadcasting stadium:control (reset) to room ${room} — auto-reset after vote:end`);
        this.server.to(room).emit('stadium:control', {
            action: 'reset',
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

        // Broadcast stage change for voter displays
        console.log(`[Gateway] Broadcasting stage:changed (announced) to room ${room}`);
        this.server.to(room).emit('stage:changed', {
            agendaId,
            stage: 'announced',
            timestamp: new Date().toISOString(),
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

    private participantCountDebounceTimers = new Map<string, NodeJS.Timeout>();

    debouncedBroadcastParticipantCount(sessionId: string) {
        const existing = this.participantCountDebounceTimers.get(sessionId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            this.participantCountDebounceTimers.delete(sessionId);
            this.broadcastParticipantCount(sessionId);
        }, 500);

        this.participantCountDebounceTimers.set(sessionId, timer);
    }

    /**
     * Get count of unique online voters — O(1) via sessionVoterSets
     */
    getOnlineVoterCount(sessionId: string): number {
        return this.sessionVoterSets.get(sessionId)?.size || 0;
    }

    /**
     * Add a voter to the session tracking set
     * Public: called from voter-state polling endpoint to track HTTP-only voters
     */
    addVoterToSession(sessionId: string, voterId: string) {
        if (!this.sessionVoterSets.has(sessionId)) {
            this.sessionVoterSets.set(sessionId, new Set());
        }
        this.sessionVoterSets.get(sessionId)!.add(voterId);
    }

    /**
     * Clear all tracked voters for a session (testing only)
     */
    clearSessionVoters(sessionId: string) {
        this.sessionVoterSets.delete(sessionId);
    }

    /**
     * Mark session as requiring re-authentication (access code changed)
     */
    setForceReauth(sessionId: string) {
        this.forceReauthAt.set(sessionId, Date.now());
    }

    /**
     * Check if a voter needs to re-authenticate based on JWT issue time
     */
    needsReauth(sessionId: string, jwtIssuedAt: number): boolean {
        const reauthAt = this.forceReauthAt.get(sessionId);
        if (!reauthAt) return false;
        // JWT iat is in seconds, forceReauthAt is in ms
        return (jwtIssuedAt * 1000) < reauthAt;
    }

    /**
     * Remove voter from session set only if they have no other active sockets
     */
    private removeVoterFromSessionIfLast(sessionId: string, voterId: string, disconnectedSocketId: string) {
        // Check if voter has any other active sockets
        for (const [socketId, client] of this.connectedUsers) {
            if (socketId !== disconnectedSocketId && client.voterId === voterId && client.sessionId === sessionId) {
                return; // voter still has another active connection
            }
        }
        // No other sockets — remove from set
        this.sessionVoterSets.get(sessionId)?.delete(voterId);
    }

    /**
     * Broadcast online participant count to session room
     * Used for real-time attendance display on stadium screen
     */
    async broadcastParticipantCount(sessionId: string) {
        try {
            const count = this.getOnlineVoterCount(sessionId);
            const room = `session:${sessionId}`.toLowerCase();
            this.server.to(room).emit('participant:count', {
                count,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            console.error(`[Gateway] Failed to broadcast participant count for session ${sessionId}:`, error.message);
        }
    }

    /**
     * Broadcast vote stats after HTTP-based vote cast (debounced)
     * Called by VotingController to replace the old Socket.IO vote:cast broadcast path
     */
    async broadcastVoteStats(agendaId: string) {
        const agenda = await this.sessionService.getAgendaWithSession(agendaId);
        if (!agenda) return;

        const stats = this.votingService.getInMemoryVoteCounts(agendaId);
        if (!stats) return;

        const room = `session:${agenda.sessionId}`.toLowerCase();

        // Debounce: only broadcast latest stats every 500ms
        this.pendingStats.set(agendaId, stats);
        if (!this.broadcastTimeouts.has(agendaId)) {
            const timeout = setTimeout(() => {
                const latestStats = this.pendingStats.get(agendaId);
                if (latestStats) {
                    this.server.to(room).emit('stats:updated', latestStats);
                }
                this.broadcastTimeouts.delete(agendaId);
                this.pendingStats.delete(agendaId);
            }, 500);
            this.broadcastTimeouts.set(agendaId, timeout);
        }
    }

    /**
     * Broadcast stage changes and child events (e.g. ended, announced)
     * Useful when updates are triggered via HTTP endpoints rather than socket signals
     */
    async broadcastStageChanged(agendaId: string, stage: string, updatedAgenda: any) {
        const room = `session:${updatedAgenda.sessionId}`.toLowerCase();
        
        console.log(`[Gateway] Broadcasting HTTP-triggered stage change: ${stage} for agenda ${agendaId} to room ${room}`);
        
        this.server.to(room).emit('stage:changed', {
            agendaId,
            stage,
            timestamp: new Date().toISOString(),
        });

        if (stage === 'ended') {
            this.server.to(room).emit('vote:ended', {
                agendaId,
                endedAt: updatedAgenda.endedAt || new Date().toISOString(),
            });
            this.server.to(room).emit('stadium:control', {
                action: 'reset',
                timestamp: new Date().toISOString(),
            });
        }

        if (stage === 'announced') {
            const stats = await this.votingService.getAgendaStatistics(agendaId);
            this.server.to(room).emit('result:published', {
                agendaId,
                stats,
                announcedAt: new Date().toISOString(),
            });
        }
    }
}
