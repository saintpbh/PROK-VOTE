import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { Session } from './session.entity';
import { Voter } from './voter.entity';

@Entity('tokens')
export class Token {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'session_id' })
    sessionId: string;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'device_fingerprint' })
    deviceFingerprint: string;

    @Column({ type: 'boolean', default: false, name: 'is_used' })
    isUsed: boolean;

    @Column({ type: 'boolean', default: false, name: 'is_revoked' })
    isRevoked: boolean;

    @Column({ type: 'timestamp', nullable: true, name: 'bound_at' })
    boundAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relationships
    @ManyToOne(() => Session, (session) => session.tokens, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'session_id' })
    session: Session;

    @OneToOne(() => Voter, (voter) => voter.token)
    voter: Voter;
}
