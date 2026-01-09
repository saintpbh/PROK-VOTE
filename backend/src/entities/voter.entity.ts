import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    OneToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { Session } from './session.entity';
import { Token } from './token.entity';
import { Vote } from './vote.entity';
import { AuditLog } from './audit-log.entity';

@Entity('voters')
export class Voter {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'token_id', nullable: true })
    tokenId: string;

    @Column({ type: 'uuid', name: 'session_id' })
    sessionId: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    name: string;

    @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true, name: 'gps_lat' })
    gpsLat: number;

    @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true, name: 'gps_lng' })
    gpsLng: number;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'device_fingerprint' })
    deviceFingerprint: string;

    @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone_number' })
    phoneNumber: string;

    @Column({ type: 'timestamp', nullable: true, name: 'sms_sent_at' })
    smsSentAt: Date;

    @Column({ type: 'boolean', default: false, name: 'access_code_verified' })
    accessCodeVerified: boolean;

    @CreateDateColumn({ name: 'verified_at' })
    verifiedAt: Date;

    // Relationships
    @OneToOne(() => Token, (token) => token.voter, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'token_id' })
    token: Token;

    @ManyToOne(() => Session, (session) => session.voters, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'session_id' })
    session: Session;

    @OneToMany(() => Vote, (vote) => vote.voter)
    votes: Vote[];

    @OneToMany(() => AuditLog, (log) => log.voter)
    auditLogs: AuditLog[];
}
