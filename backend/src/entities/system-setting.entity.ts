import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
    @PrimaryColumn({ type: 'varchar', length: 100 })
    key: string;

    @Column({ type: 'text' })
    value: string;

    @Column({ type: 'varchar', length: 50, default: 'string' })
    type: 'string' | 'number' | 'boolean' | 'json';

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
