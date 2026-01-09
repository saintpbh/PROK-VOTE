import { create } from 'zustand';

interface Session {
    id: string;
    name: string;
    description?: string;
    gpsLat?: number;
    gpsLng?: number;
    gpsRadius: number;
    gpsEnabled: boolean;
    logoUrl?: string;
    accessCode: string;
    codeExpiresAt?: string;
    status: 'pending' | 'active' | 'completed';
    stadiumTheme?: string;
    voterTheme?: string;
    entryMode?: 'UNIQUE_QR' | 'GLOBAL_LINK';
    allowAnonymous?: boolean;
    strictDeviceCheck?: boolean;
}

interface Agenda {
    id: string;
    sessionId: string;
    title: string;
    description?: string;
    displayOrder: number;
    stage: 'pending' | 'submitted' | 'voting' | 'ended' | 'announced';
    isImportant: boolean;
    startedAt?: string;
    endedAt?: string;
}

interface SessionState {
    currentSession: Session | null;
    sessions: Session[];
    agendas: Agenda[];
    currentAgenda: Agenda | null;

    // Actions
    setCurrentSession: (session: Session | null) => void;
    setSessions: (sessions: Session[]) => void;
    setAgendas: (agendas: Agenda[]) => void;
    setCurrentAgenda: (agenda: Agenda | null) => void;
    updateAgendaStage: (agendaId: string, stage: Agenda['stage']) => void;
    addAgenda: (agenda: Agenda) => void;
    removeAgenda: (agendaId: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    currentSession: null,
    sessions: [],
    agendas: [],
    currentAgenda: null,

    setCurrentSession: (session) => set({ currentSession: session }),

    setSessions: (sessions) => set({ sessions }),

    setAgendas: (agendas) => set({ agendas }),

    setCurrentAgenda: (agenda) => set({ currentAgenda: agenda }),

    updateAgendaStage: (agendaId, stage) =>
        set((state) => ({
            agendas: state.agendas.map((a) =>
                a.id === agendaId ? { ...a, stage } : a
            ),
            currentAgenda:
                state.currentAgenda?.id === agendaId
                    ? { ...state.currentAgenda, stage }
                    : state.currentAgenda,
        })),

    addAgenda: (agenda) =>
        set((state) => ({
            agendas: [...state.agendas, agenda],
        })),

    removeAgenda: (agendaId) =>
        set((state) => ({
            agendas: state.agendas.filter((a) => a.id !== agendaId),
            currentAgenda:
                state.currentAgenda?.id === agendaId ? null : state.currentAgenda,
        })),
}));
