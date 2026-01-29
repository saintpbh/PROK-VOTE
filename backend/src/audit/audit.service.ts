import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Request } from 'express';

@Injectable()
export class AuditService {
    constructor(
        @InjectRepository(AuditLog)
        private auditRepository: Repository<AuditLog>,
    ) { }

    async log(data: {
        eventType: string;
        sessionId?: string;
        voterId?: string;
        eventData?: Record<string, any>;
        req?: Request;
    }): Promise<AuditLog> {
        let ipAddress = null;
        let userAgent = null;

        if (data.req) {
            // Priority: X-Forwarded-For (Railway/Proxies) -> socket remoteAddress
            const forwardedFor = data.req.headers['x-forwarded-for'];
            ipAddress = typeof forwardedFor === 'string'
                ? forwardedFor.split(',')[0].trim()
                : data.req.socket.remoteAddress;
            userAgent = data.req.headers['user-agent'];
        }

        const logEntry = this.auditRepository.create({
            eventType: data.eventType,
            session: data.sessionId ? { id: data.sessionId } : null,
            voter: data.voterId ? { id: data.voterId } : null,
            eventData: data.eventData,
            ipAddress,
            userAgent,
        });

        return await this.auditRepository.save(logEntry);
    }

    async findAll(options: {
        sessionId?: string;
        eventType?: string;
        page?: number;
        limit?: number
    }) {
        const { sessionId, eventType, page = 1, limit = 50 } = options;
        const query = this.auditRepository.createQueryBuilder('log')
            .leftJoinAndSelect('log.session', 'session')
            .leftJoinAndSelect('log.voter', 'voter')
            .orderBy('log.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        if (sessionId) {
            query.andWhere('log.sessionId = :sessionId', { sessionId });
        }

        if (eventType) {
            query.andWhere('log.eventType = :eventType', { eventType });
        }

        const [items, total] = await query.getManyAndCount();
        return { items, total, page, limit };
    }
}
