import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    token: string | null;
    voterId: string | null;
    sessionId: string | null;
    tokenId: string | null;
    isAuthenticated: boolean;

    // Actions
    login: (token: string, voterId: string, sessionId: string, tokenId: string) => void;
    logout: () => void;
    setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            voterId: null,
            sessionId: null,
            tokenId: null,
            isAuthenticated: false,

            login: (token, voterId, sessionId, tokenId) => {
                localStorage.setItem('access_token', token);
                set({
                    token,
                    voterId,
                    sessionId,
                    tokenId,
                    isAuthenticated: true,
                });
            },

            logout: () => {
                localStorage.removeItem('access_token');
                set({
                    token: null,
                    voterId: null,
                    sessionId: null,
                    tokenId: null,
                    isAuthenticated: false,
                });
            },

            setToken: (token) => {
                localStorage.setItem('access_token', token);
                set({ token });
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);
