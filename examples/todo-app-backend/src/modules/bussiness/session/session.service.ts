import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { AppConfigService } from '../../platform/config';
import { InjectPrimaryEntityManager, SessionEntity } from '../../platform/databases/postgresql/primary';
import { SessionRecord } from './types/session-record';
import { InvalidCredentialsException, SessionExpiredException, SessionNotFoundException } from '@modules/shared/exceptions';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * sds.login.session-store: one row per live session, expiry enforced on read rather than by a sweep, so
 * a stopped sweeper can never leave a session alive past its time. Method names mirror the record's five
 * transitions (t-begin, t-accept, t-refuse, t-expire, t-revoke) so the record and the code read together.
 * The row lives in Postgres, through the platform database module's SessionEntity, reached the way
 * nivo's own capability services reach theirs: `@InjectPrimaryEntityManager()` and
 * `entityManager.findOneBy(SessionEntity, ...)` - this capability has no repository file of its own.
 *
 * Renamed from the former `SessionRepository` (under `modules/domain/session`) to `SessionService` under
 * `modules/bussiness/session` - nivo's capability modules own persistence and business rules together in
 * one `*.service.ts`, rather than a separate `*.repository.ts` layer.
 */
@Injectable()
export class SessionService {
  constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
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
    const saved = await this.entityManager.save(SessionEntity, { token: randomUUID(), personId, issuedAt, expiresAt });
    return toRecord(saved);
  }

  tRefuse(): void {
    // Nothing is written, and the refusal that follows does not say which half was wrong.
  }

  async tExpire(token: string): Promise<void> {
    await this.entityManager.delete(SessionEntity, token);
  }

  async tRevoke(token: string): Promise<void> {
    await this.entityManager.delete(SessionEntity, token);
  }

  async findActive(token: string): Promise<SessionRecord> {
    // A missing/empty token is refused here, before any query is issued. This is deliberate, not
    // cosmetic: real TypeORM criteria drop an `undefined` property from the generated WHERE clause
    // rather than filtering on it, so `findOneBy(SessionEntity, { token: undefined })` would match the
    // first row TypeORM's ordering happens to return instead of refusing - exactly the auth bypass a
    // real-browser uat.verify run found against the pre-refactor REST controllers (an absent
    // `Authorization` header reached `findOneBy({ token: undefined })` and matched an arbitrary
    // session). Refusing on a falsy token before the call ever reaches the database makes that failure
    // mode unreachable from here regardless of what the ORM does with `undefined`.
    if (!token) {
      throw new SessionNotFoundException({ reason: 'missing-token' });
    }
    const row = await this.entityManager.findOneBy(SessionEntity, { token });
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
