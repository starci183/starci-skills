import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AccountService } from '../../../../modules/bussiness/account';
import { SessionService } from '../../../../modules/bussiness/session';

export interface SignInParams {
  email?: unknown;
  password?: unknown;
}

@Controller('auth')
export class SignInController {
  constructor(
    private readonly accounts: AccountService,
    private readonly sessions: SessionService,
  ) {}

  /** The demo signup door - what makes the live proof repeatable: every run registers a fresh
   * visitor instead of reusing the seeded person. A taken address is 409, nothing else. */
  @Post('register')
  async register(@Body() body: SignInParams): Promise<{ personId: string }> {
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email.includes('@') || password.length < 8) {
      throw new HttpException({ code: 'REQUEST_INVALID', message: 'A plausible email and a password of at least 8 characters are required.' }, HttpStatus.BAD_REQUEST);
    }
    const personId = await this.accounts.register(email, password);
    if (!personId) {
      throw new HttpException({ code: 'EMAIL_TAKEN', message: 'An account already answers this email.' }, HttpStatus.CONFLICT);
    }
    return { personId };
  }

  /** fr.identity.sign-in: the pair is checked, and exactly one live session answers. A refusal
   * names neither half (br.identity.sign-in) - unknown email and wrong password are the same
   * status and the same body. */
  @Post('sign-in')
  async signIn(@Body() body: SignInParams): Promise<{ sessionToken: string; personId: string }> {
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) {
      throw new HttpException({ code: 'REQUEST_INVALID', message: 'email and password are required.' }, HttpStatus.BAD_REQUEST);
    }
    const personId = await this.accounts.verifyCredentials(email, password);
    if (!personId) {
      throw new HttpException({ code: 'INVALID_CREDENTIALS', message: 'The email and password pair is not recognized.' }, HttpStatus.UNAUTHORIZED);
    }
    return this.sessions.issue(personId);
  }
}
