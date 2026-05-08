import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

/**
 * VoteLog: Granular audit record for individual votes.
 * Separate from the Vote entity to allow archival and trash lifecycle.
 */
@Entity('vote_logs')
export class VoteLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'uuid', name: 'session_id' })
    sessionId: string;

    @Index()
    @Column({ type: 'uuid', name: 'agenda_id' })
    agendaId: string;

    @Column({ type: 'varchar', length: 500, name: 'agenda_title' })
    agendaTitle: string;

    @Column({ type: 'varchar', length: 255, name: 'voter_browser_id', nullable: true })
    voterBrowserId: string;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'voter_name' })
    voterName: string;

    @Column({ type: 'varchar', length: 500 })
    choice: string;

    @CreateDateColumn({ name: 'voted_at' })
    votedAt: Date;

    /** 'active' | 'archived' | 'trashed' */
    @Column({ type: 'varchar', length: 20, default: 'active' })
    status: 'active' | 'archived' | 'trashed';

    @Column({ type: 'timestamp', nullable: true, name: 'trashed_at' })
    trashedAt: Date;
}
