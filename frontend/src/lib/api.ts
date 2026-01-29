import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor to add JWT token
        this.client.interceptors.request.use(
            (config) => {
                const adminToken = localStorage.getItem('admin_access_token');
                const token = localStorage.getItem('access_token');

                // Prioritize admin token if present
                const activeToken = adminToken || token;

                if (activeToken) {
                    config.headers.Authorization = `Bearer ${activeToken}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response.data,
            (error: AxiosError) => {
                const apiError = new Error() as any;
                if (error.response) {
                    // Server responded with error
                    apiError.message = (error.response.data as any)?.message || 'Server error';
                    apiError.status = error.response.status;
                    apiError.data = error.response.data;
                } else if (error.request) {
                    // Request made but no response
                    apiError.message = 'No response from server';
                    apiError.status = 0;
                } else {
                    // Something else happened
                    apiError.message = error.message;
                }
                return Promise.reject(apiError);
            }
        );
    }

    // Auth endpoints
    async generateTokens(sessionId: string, count: number): Promise<any> {
        return this.client.post('/auth/generate-tokens', { sessionId, count });
    }

    async verifyQR(tokenId: string, deviceFingerprint: string): Promise<any> {
        return this.client.post('/auth/verify-qr', { tokenId, deviceFingerprint });
    }

    async completeAuth(data: {
        tokenId: string;
        deviceFingerprint: string;
        latitude: number;
        longitude: number;
        accessCode: string;
        skipGPS?: boolean;
    }): Promise<any> {
        return this.client.post('/auth/complete', data);
    }

    async getToken(tokenId: string): Promise<any> {
        return this.client.get(`/auth/token/${tokenId}`);
    }

    async completeGlobalAuth(data: {
        sessionId: string;
        name: string;
        deviceFingerprint: string;
        latitude: number;
        longitude: number;
        accessCode: string;
        skipGPS?: boolean;
    }): Promise<any> {
        return this.client.post('/auth/global', data);
    }

    async getPublicSession(sessionId: string): Promise<any> {
        return this.client.get(`/sessions/public/${sessionId}`);
    }

    async generateAccessCode(): Promise<any> {
        return this.client.get('/auth/generate-code');
    }

    async adminLogin(data: { username?: string, password?: string } | string): Promise<any> {
        if (typeof data === 'string') {
            // Backward compatibility for old calls
            return this.client.post('/auth/admin/login', { username: 'admin', password: data });
        }
        return this.client.post('/auth/admin/login', data);
    }

    async register(data: { username: string; password: string; email?: string }): Promise<any> {
        return this.client.post('/auth/register', data);
    }

    setToken(token: string) {
        localStorage.setItem('access_token', token);
    }

    setAdminToken(token: string) {
        localStorage.setItem('admin_access_token', token);
    }

    removeToken() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('admin_access_token');
    }

    isAuthenticated(): boolean {
        return !!localStorage.getItem('access_token');
    }

    isAdminAuthenticated(): boolean {
        return !!localStorage.getItem('admin_access_token');
    }

    // Session endpoints
    async createSession(data: {
        name: string;
        description?: string;
        gpsLat?: number;
        gpsLng?: number;
        gpsRadius?: number;
        gpsEnabled?: boolean;
        strictDeviceCheck?: boolean;
    }): Promise<any> {
        return this.client.post('/sessions', data);
    }

    async getAllSessions(): Promise<any> {
        return this.client.get('/sessions');
    }

    async getSession(sessionId: string): Promise<any> {
        return this.client.get(`/sessions/${sessionId}`);
    }

    async updateAccessCode(sessionId: string): Promise<any> {
        return this.client.put(`/sessions/${sessionId}/access-code`);
    }

    async deleteSession(sessionId: string): Promise<any> {
        return this.client.delete(`/sessions/${sessionId}`);
    }

    async updateSessionSettings(sessionId: string, settings: {
        stadiumTheme?: string;
        voterTheme?: string;
        entryMode?: 'UNIQUE_QR' | 'GLOBAL_LINK';
        allowAnonymous?: boolean;
        strictDeviceCheck?: boolean;
    }): Promise<any> {
        return this.client.put(`/sessions/${sessionId}/settings`, settings);
    }

    async importVoters(sessionId: string, voters: { name: string; phoneNumber: string }[]): Promise<any> {
        return this.client.post(`/sessions/${sessionId}/voters/import`, { voters });
    }

    async sendSmsLinks(sessionId: string): Promise<any> {
        return this.client.post(`/sessions/${sessionId}/voters/send-sms`);
    }

    async uploadSessionLogo(sessionId: string, file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.client.post(`/sessions/${sessionId}/logo`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    }

    async createAgenda(data: {
        sessionId: string;
        title: string;
        description?: string;
        displayOrder?: number;
        isImportant?: boolean;
        type?: 'PROS_CONS' | 'MULTIPLE_CHOICE' | 'INPUT';
        options?: string[];
    }): Promise<any> {
        return this.client.post('/sessions/agendas', data);
    }

    async getSessionAgendas(sessionId: string): Promise<any> {
        return this.client.get(`/sessions/${sessionId}/agendas`);
    }

    async updateAgendaStage(agendaId: string, stage: string): Promise<any> {
        return this.client.put(`/sessions/agendas/${agendaId}/stage`, { stage });
    }

    async deleteAgenda(agendaId: string): Promise<any> {
        return this.client.delete(`/sessions/agendas/${agendaId}`);
    }

    // Voting endpoints
    async castVote(voterId: string, agendaId: string, choice: string): Promise<any> {
        return this.client.post('/votes', { voterId, agendaId, choice });
    }

    async getVoteStatistics(agendaId: string): Promise<any> {
        return this.client.get(`/votes/stats/${agendaId}`);
    }

    async checkVoted(voterId: string, agendaId: string): Promise<any> {
        return this.client.get(`/votes/check/${voterId}/${agendaId}`);
    }

    async getVote(voterId: string, agendaId: string): Promise<any> {
        return this.client.get(`/votes/${voterId}/${agendaId}`);
    }
    async generateToken(sessionId: string): Promise<{ success: boolean; token?: string }> {
        try {
            const response = await this.client.post('/auth/generate-tokens', { sessionId, count: 1 }) as any;
            if (response.success && response.tokens && response.tokens.length > 0) {
                return { success: true, token: response.tokens[0] };
            }
            return { success: false };
        } catch (error) {
            console.error('Failed to generate token:', error);
            return { success: false };
            return { success: false };
        }
    }

    async resetParticipants(sessionId: string): Promise<any> {
        return this.client.post(`/sessions/${sessionId}/reset-participants`);
    }

    async getParticipantCount(sessionId: string): Promise<any> {
        return this.client.get(`/sessions/${sessionId}/participants/count`);
    }

    async exportSessionResults(sessionId: string): Promise<void> {
        const response = await this.client.get(`/sessions/${sessionId}/export`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response as any]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `session_${sessionId}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
    async getAllSettings(): Promise<any> {
        return this.client.get('/settings');
    }

    async updateSetting(key: string, value: string, type: string): Promise<any> {
        return this.client.post('/settings', { key, value, type });
    }

    // User Management (Super Admin)
    async getAllManagers(): Promise<any> {
        return this.client.get('/users/managers');
    }

    async createManager(data: any): Promise<any> {
        return this.client.post('/users/managers', data);
    }

    async updateUserQuotas(id: string, quotas: any): Promise<any> {
        return this.client.put(`/users/managers/${id}/quotas`, quotas);
    }

    async setUserStatus(id: string, isActive: boolean): Promise<any> {
        return this.client.put(`/users/managers/${id}/status`, { isActive });
    }
}

const api = new ApiClient();
export default api;
