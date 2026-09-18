import { Injectable } from '@nestjs/common';
import { scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * The demo credential scheme: scrypt with a fixed per-example salt, verified in constant time.
 * A real product delegates passwords to an identity provider (todo's login feature shows that
 * shape with Keycloak); this example keeps the verification local and honest about it being a
 * demo - the seeded hash in the migration is computed with exactly this salt.
 */
export const DEMO_PASSWORD_SALT = 'ecommerce-app-demo';

@Injectable()
export class PasswordPolicy {
  hash(plain: string): string {
    return scryptSync(plain, DEMO_PASSWORD_SALT, 64).toString('hex');
  }

  verify(plain: string, storedHashHex: string): boolean {
    const candidate = Buffer.from(scryptSync(plain, DEMO_PASSWORD_SALT, 64).toString('hex'));
    const stored = Buffer.from(storedHashHex);
    if (candidate.length !== stored.length) return false;
    return timingSafeEqual(candidate, stored);
  }
}
