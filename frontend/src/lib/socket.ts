import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

class SocketService {
    private socket: Socket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private currentSession: { sessionId: string; voterId?: string; role?: string } | null = null;
    private messageQueue: { event: string; data: any }[] = [];

    connect(forceNew: boolean = false): Socket {
        if (this.socket?.connected && !forceNew) {
            return this.socket;
        }

        if (this.socket && forceNew) {
            this.socket.disconnect();
        }

        console.log('[Socket] Connecting to:', SOCKET_URL);
        this.socket = io(SOCKET_URL, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            auth: (cb) => {
                const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;
                const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
                cb({ token: adminToken || token });
            }
        });

        this.setupEventListeners();
        return this.socket;
    }

    private setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            const socketId = this.socket?.id;
            console.log('✅ WebSocket connected:', socketId);
            this.reconnectAttempts = 0;

            // Process queued messages
            if (this.messageQueue.length > 0) {
                console.log(`[Socket] Processing ${this.messageQueue.length} queued messages...`);
                const queue = [...this.messageQueue];
                this.messageQueue = [];
                queue.forEach(({ event, data }) => this.emit(event, data));
            }

            // Auto-rejoin session if we were in one
            if (this.currentSession) {
                console.log('🔄 Auto-rejoining session after connect...');
                this.joinSession(
                    this.currentSession.sessionId,
                    this.currentSession.voterId,
                    this.currentSession.role
                );
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('🔥 Connection error:', error);
            this.reconnectAttempts++;

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnection attempts reached');
            }
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    getSocket(): Socket | null {
        return this.socket;
    }

    emit(event: string, data?: any) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn(`[Socket] Not connected. Queueing event: ${event}`);
            this.messageQueue.push({ event, data });

            // If socket doesn't exist at all, try to connect
            if (!this.socket) {
                this.connect();
            }
        }
    }

    on(event: string, callback: (...args: any[]) => void) {
        if (!this.socket) this.connect();
        this.socket?.on(event, callback);
    }

    off(event: string, callback?: (...args: any[]) => void) {
        this.socket?.off(event, callback);
    }

    joinSession(sessionId: string, voterId?: string, role?: string) {
        console.log(`[Socket] joinSession request: sessionId=${sessionId}, role=${role}`);
        // Store for auto-rejoin
        this.currentSession = { sessionId, voterId, role };

        if (this.socket?.connected) {
            console.log(`[Socket] Emitting join:session room: ${sessionId} as ${role || 'voter'}`);
            this.socket.emit('join:session', { sessionId, voterId, role });
        } else {
            console.log(`[Socket] Queueing join:session for when connected: ${sessionId}`);
            // The 'connect' listener will pick this up via this.currentSession
            if (!this.socket) this.connect();
        }
    }
}

const socketService = new SocketService();
export default socketService;
