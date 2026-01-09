import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Token } from './token.entity';
import { Voter } from './voter.entity';
import { Agenda } from './agenda.entity';
import { AuditLog } from './audit-log.entity';

@Entity('sessions')
export class Session {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true, name: 'gps_lat' })
    gpsLat: number;

    @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true, name: 'gps_lng' })
    gpsLng: number;

    @Column({ type: 'int', default: 100, name: 'gps_radius' })
    gpsRadius: number;

    @Column({ type: 'boolean', default: true, name: 'gps_enabled' })
    gpsEnabled: boolean;

    @Column({ type: 'char', length: 4, name: 'access_code' })
    accessCode: string;

    @Column({ type: 'timestamp', nullable: true, name: 'code_expires_at' })
    codeExpiresAt: Date;

    @Column({ type: 'text', nullable: true, name: 'logo_url' })
    logoUrl: string;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status: 'pending' | 'active' | 'completed';

    @Column({ type: 'varchar', length: 50, default: 'classic', name: 'stadium_theme' })
    stadiumTheme: string;

    @Column({ type: 'varchar', length: 50, default: 'classic', name: 'voter_theme' })
    voterTheme: string;

    @Column({ type: 'varchar', length: 50, default: 'UNIQUE_QR', name: 'entry_mode' })
    entryMode: 'UNIQUE_QR' | 'GLOBAL_LINK';

    @Column({ type: 'boolean', default: true, name: 'allow_anonymous' })
    allowAnonymous: boolean;

    @Column({ type: 'boolean', default: true, name: 'strict_device_check' })
    strictDeviceCheck: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relationships
    @OneToMany(() => Token, (token) => token.session)
    tokens: Token[];

    @OneToMany(() => Voter, (voter) => voter.session)
    voters: Voter[];

    @OneToMany(() => Agenda, (agenda) => agenda.session)
    agendas: Agenda[];

    @OneToMany(() => AuditLog, (log) => log.session)
    auditLogs: AuditLog[];

    @ManyToOne(() => User, (user) => user.sessions)
    @JoinColumn({ name: 'owner_id' })
    owner: User;

    @Column({ name: 'owner_id', nullable: true })
    ownerId: string;
}
