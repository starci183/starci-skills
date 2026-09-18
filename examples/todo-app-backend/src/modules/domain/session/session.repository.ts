import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AppConfigService } from '../../platform/config';
import { SessionEntity } from '../../integrations/postgres';
import { SessionRecord } from './session-record.types';
import { InvalidCredentialsException, SessionExpiredException, SessionNotFoundException } from './session.exception';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * sds.login.session-store: one row per live session, expiry enforced on read rather than by a sweep, so
 * a stopped sweeper can never leave a session alive past its time. Method names mirror the record's five
 * transitions (t-begin, t-accept, t-refuse, t-expire, t-revoke) so the record and the code read together.
 * The row lives in Postgres, through the platform database module's SessionEntity.
 */
@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(SessionEntity) private readonly rows: Repository<SessionEntity>,
    private readonly config: AppConfigService,
  ) {}

  tBegin(email: string): void {
    if (!EMAIL_PATTERN.test(email)) {
      throw new InvalidCredentialsException();
    }
  }

  async tAccept(personId: string): Promise<SessionRecord> {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.config.getSessionTtlDays() * MILLISECONDS_PER_DAY);
    const saved = await this.rows.save({ token: randomUUID(), personId, issuedAt, expiresAt });
    return toRecord(saved);
  }

  tRefuse(): void {
    // Nothing is written, and the refusal that follows does not say which half was wrong.
  }

  async tExpire(token: string): Promise<void> {
    await this.rows.delete(token);
  }

  async tRevoke(token: string): Promise<void> {
    await this.rows.delete(token);
  }

  async findActive(token: string): Promise<SessionRecord> {
    const row = await this.rows.findOneBy({ token });
    if (!row) {
      throw new SessionNotFoundException();
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.tExpire(token);
      throw new SessionExpiredException();
    }
    return toRecord(row);
  }
}

function toRecord(row: SessionEntity): SessionRecord {
  return new SessionRecord(row.token, row.personId, row.issuedAt, row.expiresAt);
}
