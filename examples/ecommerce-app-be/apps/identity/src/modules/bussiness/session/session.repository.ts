import { Injectable } from '@nestjs/common';
import { RedisPrimaryClient } from '../../platform/caches/redis/primary';

const SESSION_KEY_PREFIX = 'identity:session:';

/**
 * The session store of sds.login.session-store's shape moved to Redis (integration.checkout.redis):
 * one key per live opaque token, TTL-bound, expiry enforced by the store itself. The lookup goes
 * through this repository only - no other reader touches the keys.
 */
@Injectable()
export class SessionRepository {
  constructor(private readonly redis: RedisPrimaryClient) {}

  keyFor(token: string): string {
    return `${SESSION_KEY_PREFIX}${token}`;
  }

  async store(token: string, personId: string, ttlSeconds: number): Promise<void> {
    await this.redis.store(this.keyFor(token), personId, ttlSeconds);
  }

  async lookup(token: string): Promise<string | null> {
    return this.redis.lookup(this.keyFor(token));
  }

  async forget(token: string): Promise<void> {
    await this.redis.forget(this.keyFor(token));
  }
}
