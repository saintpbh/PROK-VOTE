import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Session } from './session.entity';
import { Voter } from './voter.entity';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;


    @Column({ type: 'varchar', length: 100, name: 'event_type' })
    eventType: string;

    @Column({ type: 'jsonb', nullable: true, name: 'event_data' })
    eventData: Record<string, any>;

    @Column({ type: 'inet', nullable: true, name: 'ip_address' })
    ipAddress: string;

    @Column({ type: 'text', nullable: true, name: 'user_agent' })
    userAgent: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relationships
    @ManyToOne(() => Session, (session) => session.auditLogs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'session_id' })
    session: Session;

    @ManyToOne(() => Voter, (voter) => voter.auditLogs, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'voter_id' })
    voter: Voter;
}
