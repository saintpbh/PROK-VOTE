import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Voter } from './voter.entity';
import { Agenda } from './agenda.entity';

export type VoteChoice = '찬성' | '반대' | '기권';

@Entity('votes')
export class Vote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'voter_id' })
    voterId: string;

    @Column({ type: 'uuid', name: 'agenda_id' })
    agendaId: string;

    @Column({ type: 'varchar', length: 50 })
    choice: VoteChoice;

    @CreateDateColumn({ name: 'voted_at' })
    votedAt: Date;

    // Relationships
    @ManyToOne(() => Voter, (voter) => voter.votes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'voter_id' })
    voter: Voter;

    @ManyToOne(() => Agenda, (agenda) => agenda.votes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'agenda_id' })
    agenda: Agenda;
}
