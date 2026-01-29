import { Injectable, OnModuleInit, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    async onModuleInit() {
        // Seed default super admin if 'admin' user doesn't exist
        const adminUser = await this.findByUsername('admin');
        if (!adminUser) {
            console.log('🌱 Admin user not found. Seeding default super admin...');
            const password = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
            await this.createUser('admin', password, UserRole.SUPER_ADMIN);
            console.log('✅ Default super admin created: admin (PW: ' + (process.env.SUPER_ADMIN_PASSWORD ? 'FROM_ENV' : 'admin123') + ')');
        } else {
            console.log('🛡️ Admin user already exists.');
        }
    }


    async createUser(
        usernameOrData: string | Partial<User>,
        password?: string,
        role?: UserRole,
        quotas?: Partial<Pick<User, 'maxSessions' | 'maxAgendasPerSession' | 'maxVotersPerSession'>>
    ) {
        let userData: Partial<User>;

        // Support both old signature (string params) and new signature (object param)
        if (typeof usernameOrData === 'string') {
            // Legacy signature: createUser('username', 'password', UserRole.SUPER_ADMIN, quotas)
            const existing = await this.usersRepository.findOne({ where: { username: usernameOrData } });
            if (existing) {
                throw new ConflictException('Username already exists');
            }

            const passwordHash = await bcrypt.hash(password, 10);
            userData = {
                username: usernameOrData,
                passwordHash,
                role,
                ...quotas,
            };
        } else {
            // New signature: createUser({ username, email, passwordHash, role, ... })
            const existing = await this.usersRepository.findOne({ where: { username: usernameOrData.username } });
            if (existing) {
                throw new ConflictException('Username already exists');
            }

            userData = usernameOrData;
        }

        const user = this.usersRepository.create(userData);
        return await this.usersRepository.save(user);
    }

    async findByUsername(username: string): Promise<User | undefined> {
        return await this.usersRepository.findOne({ where: { username } });
    }

    async findById(id: string): Promise<User | undefined> {
        return await this.usersRepository.findOne({ where: { id } });
    }

    async findAllManagers(): Promise<User[]> {
        return await this.usersRepository.find({
            where: { role: UserRole.VOTE_MANAGER },
            order: { createdAt: 'DESC' }
        });
    }

    async updateUserQuotas(id: string, quotas: Partial<Pick<User, 'maxSessions' | 'maxAgendasPerSession' | 'maxVotersPerSession'>>) {
        await this.usersRepository.update(id, quotas);
        return await this.findById(id);
    }

    async setAccountStatus(id: string, isActive: boolean) {
        await this.usersRepository.update(id, { isActive });
        return await this.findById(id);
    }
}
