import { io, Socket } from 'socket.io-client';

// Production-aware logger — silences debug noise in production
const isProd = process.env.NODE_ENV === 'production';
const logger = {
    debug: (...args: any[]) => { if (!isProd) console.log(...args); },
    info: (...args: any[]) => console.log(...args),
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args),
};

let SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL;

if (!SOCKET_URL) {
    SOCKET_URL = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : 'http://localhost:3001';
} else if (!SOCKET_URL.startsWith('http') && typeof window !== 'undefined') {
    SOCKET_URL = `https://${SOCKET_URL}`;
}

class SocketService {
    private socket: Socket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private currentSession: { sessionId: string; voterId?: string; role?: string } | null = null;
    private messageQueue: { event: string; data: any }[] = [];
    private joinDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    connect(forceNew: boolean = false): Socket {
        if (this.socket?.connected && !forceNew) {
            return this.socket;
        }

        if (this.socket && forceNew) {
            this.socket.disconnect();
        }

        logger.debug('[Socket] Connecting to:', SOCKET_URL);
        // iOS Safari has a WebKit bug with WebSocket upgrades on HTTP/2 (Cloud Run).
        // Forcing iOS to use polling-only prevents hanging connections.
        const isIOS = typeof navigator !== 'undefined' && (
            /iPhone|iPad|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );

        this.socket = io(SOCKET_URL, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            transports: isIOS ? ['polling'] : ['polling', 'websocket'],
            upgrade: !isIOS,
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
            logger.debug('[Socket] Connected:', this.socket?.id);
            this.reconnectAttempts = 0;

            // Process queued messages
            if (this.messageQueue.length > 0) {
                const queue = [...this.messageQueue];
                this.messageQueue = [];
                queue.forEach(({ event, data }) => this.emit(event, data));
            }

            // Auto-rejoin session if we were in one (debounced)
            if (this.currentSession) {
                this.debouncedJoin(
                    this.currentSession.sessionId,
                    this.currentSession.voterId,
                    this.currentSession.role
                );
            }
        });

        this.socket.on('disconnect', (reason) => {
            logger.debug('[Socket] Disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
            this.reconnectAttempts++;
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                logger.error('[Socket] Max reconnection attempts reached:', error.message);
            }
        });

        this.socket.on('reconnect', (attemptNumber) => {
            logger.debug('[Socket] Reconnected after', attemptNumber, 'attempts');
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
            logger.debug(`[Socket] Queueing event: ${event}`);
            this.messageQueue.push({ event, data });
            if (!this.socket) this.connect();
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
        this.currentSession = { sessionId, voterId, role };
        this.debouncedJoin(sessionId, voterId, role);
    }

    // Debounced join prevents duplicate join:session spam when multiple
    // components call joinSession in quick succession (mount + auto-rejoin)
    private debouncedJoin(sessionId: string, voterId?: string, role?: string) {
        if (this.joinDebounceTimer) clearTimeout(this.joinDebounceTimer);

        this.joinDebounceTimer = setTimeout(() => {
            if (this.socket?.connected) {
                logger.debug(`[Socket] join:session ${sessionId} as ${role || 'voter'}`);
                this.socket.emit('join:session', { sessionId, voterId, role });
            } else {
                if (!this.socket) this.connect();
            }
        }, 100);
    }
}

const socketService = new SocketService();
export default socketService;
