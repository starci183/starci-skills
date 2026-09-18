import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { InvalidCredentialsException } from './session.exception';

const KEY_LENGTH = 64;
const DECOY_PLAINTEXT = 'decoy-password-for-timing-safety';

/**
 * nfr.login.sign-in-timing requires that an unknown email and a wrong password produce refusals that do
 * not separate by timing. getDecoyHash() gives the caller a fixed, precomputed hash so the caller can run
 * the same assertMatches() work for an unknown email as for a known one with a wrong password, instead of
 * returning early when nobody was found.
 */
@Injectable()
export class PasswordService {
  private readonly decoyHash = this.hash(DECOY_PLAINTEXT);

  hash(plain: string): string {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(plain, salt, KEY_LENGTH).toString('hex');
    return `${salt}:${derived}`;
  }

  assertMatches(plain: string, storedHash: string): void {
    const [salt, derived] = storedHash.split(':');
    if (!salt || !derived || !this.matches(plain, salt, derived)) {
      throw new InvalidCredentialsException();
    }
  }

  getDecoyHash(): string {
    return this.decoyHash;
  }

  private matches(plain: string, salt: string, derivedHex: string): boolean {
    const candidate = scryptSync(plain, salt, KEY_LENGTH);
    const expected = Buffer.from(derivedHex, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
}
