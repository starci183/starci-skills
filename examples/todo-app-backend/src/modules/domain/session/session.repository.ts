import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SessionRecord } from './session-record.types';
import { InvalidCredentialsException, SessionExpiredException, SessionNotFoundException } from './session.exception';

const SESSION_TTL_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * sds.login.session-store: one row per live session, expiry enforced on read rather than by a sweep, so
 * a stopped sweeper can never leave a session alive past its time. Method names mirror the record's five
 * transitions (t-begin, t-accept, t-refuse, t-expire, t-revoke) so the record and the code read together.
 */
@Injectable()
export class SessionRepository {
  private readonly rows = new Map<string, SessionRecord>();

  tBegin(email: string): void {
    if (!EMAIL_PATTERN.test(email)) {
      throw new InvalidCredentialsException();
    }
  }

  tAccept(personId: string): SessionRecord {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_DAYS * MILLISECONDS_PER_DAY);
    const record = new SessionRecord(randomUUID(), personId, issuedAt, expiresAt);
    this.rows.set(record.token, record);
    return record;
  }

  tRefuse(): void {
    // Nothing is written, and the refusal that follows does not say which half was wrong.
  }

  tExpire(token: string): void {
    this.rows.delete(token);
  }

  tRevoke(token: string): void {
    this.rows.delete(token);
  }

  findActive(token: string): SessionRecord {
    const row = this.rows.get(token);
    if (!row) {
      throw new SessionNotFoundException();
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      this.tExpire(token);
      throw new SessionExpiredException();
    }
    return row;
  }
}
