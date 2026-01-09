import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { Session } from './session.entity';
import { Vote } from './vote.entity';

export type AgendaStage = 'pending' | 'submitted' | 'voting' | 'ended' | 'announced';
export type AgendaType = 'PROS_CONS' | 'MULTIPLE_CHOICE' | 'INPUT';

@Entity('agendas')
export class Agenda {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'session_id' })
    sessionId: string;

    @Column({ type: 'varchar', length: 500 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 20, default: 'PROS_CONS' })
    type: AgendaType;

    @Column({ type: 'jsonb', nullable: true })
    options: string[];

    @Column({ type: 'int', default: 0, name: 'display_order' })
    displayOrder: number;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    stage: AgendaStage;

    @Column({ type: 'boolean', default: false, name: 'is_important' })
    isImportant: boolean;

    @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
    startedAt: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'ended_at' })
    endedAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relationships
    @ManyToOne(() => Session, (session) => session.agendas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'session_id' })
    session: Session;

    @OneToMany(() => Vote, (vote) => vote.agenda)
    votes: Vote[];
}
