import { create } from 'zustand';

export type VoteChoice = '찬성' | '반대' | '기권';

interface VoteStatistics {
    agendaId: string;
    title: string;
    totalVotes: number;
    approveCount: number;
    rejectCount: number;
    abstainCount: number;
    turnoutPercentage: number;
    totalParticipants: number;
}

interface VotingState {
    hasVoted: boolean;
    myVote: VoteChoice | null;
    votingEnabled: boolean;
    statistics: VoteStatistics | null;

    // Actions
    setHasVoted: (voted: boolean) => void;
    setMyVote: (vote: VoteChoice | null) => void;
    setVotingEnabled: (enabled: boolean) => void;
    setStatistics: (stats: VoteStatistics | null) => void;
    reset: () => void;
}

export const useVotingStore = create<VotingState>((set) => ({
    hasVoted: false,
    myVote: null,
    votingEnabled: false,
    statistics: null,

    setHasVoted: (voted) => set({ hasVoted: voted }),

    setMyVote: (vote) => set({ myVote: vote }),

    setVotingEnabled: (enabled) => set({ votingEnabled: enabled }),

    setStatistics: (stats) => set({ statistics: stats }),

    reset: () =>
        set({
            hasVoted: false,
            myVote: null,
            votingEnabled: false,
            statistics: null,
        }),
}));
