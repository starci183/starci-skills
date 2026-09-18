import { HttpException } from '@nestjs/common';
import { AppConfigService } from '../../../../modules/platform/config';
import { RedisPrimaryClient } from '../../../../modules/platform/caches/redis/primary';
import { AccountService } from '../../../../modules/bussiness/account';
import { SessionRepository, SessionService } from '../../../../modules/bussiness/session';
import { SignInController } from './sign-in.controller';

/**
 * br.identity.sign-in in unit form: the controller drives the real SessionService over an
 * in-memory stand-in for the Redis store (the real-server round-trip is integration.checkout.redis's
 * own proof, and the full wire shape is scripts/live-proof.mjs). The credential check itself is
 * faked at its answer - PasswordPolicy.verify is covered against the seeded hash in
 * password.policy.spec.ts.
 */
function signInController(answer: string | null): SignInController {
  const store = new Map<string, string>();
  const redis = {
    async store(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async lookup(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async forget(key: string): Promise<void> {
      store.delete(key);
    },
  } as unknown as RedisPrimaryClient;
  const config = { getSessionTtlSeconds: () => 60 } as AppConfigService;
  const sessions = new SessionService(new SessionRepository(redis), config);
  const accounts = {
    async verifyCredentials(): Promise<string | null> {
      return answer;
    },
  } as unknown as AccountService;
  return new SignInController(accounts, sessions);
}

describe('SignInController - br.identity.sign-in', () => {
  it('ac.identity.sign-in.known-pair-issues-a-session-token', async () => {
    const controller = signInController('person-1');
    const first = await controller.signIn({ email: 'demo@ecommerce.dev', password: 'ecommerce-demo' });
    expect(typeof first.sessionToken).toBe('string');
    expect(first.personId).toBe('person-1');
    const second = await controller.signIn({ email: 'demo@ecommerce.dev', password: 'ecommerce-demo' });
    expect(second.sessionToken).not.toBe(first.sessionToken);
  });

  it('ac.identity.sign-in.wrong-pair-is-refused-alike', async () => {
    const controller = signInController(null);
    const refusals: Array<{ status: number; body: unknown }> = [];
    for (const body of [
      { email: 'demo@ecommerce.dev', password: 'wrong-password' },
      { email: 'nobody@ecommerce.dev', password: 'ecommerce-demo' },
    ]) {
      try {
        await controller.signIn(body);
        throw new Error('sign-in should have been refused');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const http = error as HttpException;
        refusals.push({ status: http.getStatus(), body: http.getResponse() });
      }
    }
    // Unknown email and wrong password refuse indistinguishably - same status, same body.
    expect(refusals[0]).toEqual(refusals[1]);
    expect(refusals[0].status).toBe(401);
    expect(refusals[0].body).toEqual({ code: 'INVALID_CREDENTIALS', message: 'The email and password pair is not recognized.' });
  });

  it('fr.identity.sign-in refuses a request missing a half before any credential check', async () => {
    const controller = signInController('person-1');
    try {
      await controller.signIn({ email: 'demo@ecommerce.dev' });
      throw new Error('the request should have been refused');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
      expect((error as HttpException).getResponse()).toEqual({ code: 'REQUEST_INVALID', message: 'email and password are required.' });
    }
  });
});
