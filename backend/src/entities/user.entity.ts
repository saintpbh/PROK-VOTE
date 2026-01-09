import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Session } from './session.entity';

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    VOTE_MANAGER = 'VOTE_MANAGER'
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    username: string;

    @Column({ nullable: true })
    email?: string;

    @Column()
    passwordHash: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.VOTE_MANAGER
    })
    role: UserRole;

    @Column({ default: true })
    isActive: boolean;

    // Quotas
    @Column({ default: 5 })
    maxSessions: number;

    @Column({ default: 20 })
    maxAgendasPerSession: number;

    @Column({ default: 500 })
    maxVotersPerSession: number;

    @OneToMany(() => Session, (session) => session.owner)
    sessions: Session[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
