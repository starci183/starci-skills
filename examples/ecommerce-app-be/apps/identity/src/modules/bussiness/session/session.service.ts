import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../platform/config';
import { SessionRepository } from './session.repository';

export interface IssuedSessionResult {
  sessionToken: string;
  personId: string;
}

/** fr.identity.sign-in / br.identity.sign-in: issue, verify, revoke. The token is an opaque
 * uuid - never a self-describing credential - and a verification returns only the person. */
@Injectable()
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly config: AppConfigService,
  ) {}

  async issue(personId: string): Promise<IssuedSessionResult> {
    const sessionToken = randomUUID();
    await this.sessions.store(sessionToken, personId, this.config.getSessionTtlSeconds());
    return { sessionToken, personId };
  }

  async verify(sessionToken: string): Promise<string | null> {
    if (!sessionToken) return null;
    return this.sessions.lookup(sessionToken);
  }

  async revoke(sessionToken: string): Promise<void> {
    await this.sessions.forget(sessionToken);
  }
}
