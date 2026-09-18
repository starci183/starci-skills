import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { SessionService } from '../../../../modules/bussiness/session';

export interface VerifySessionParams {
  sessionToken?: unknown;
}

/**
 * The session surface the order service calls (its integrations/identity client): the bearer
 * token travels in a JSON body on an internal route, and the answer is only ever the person
 * behind a live session - or a typed 401 the consumer propagates as its own refusal.
 */
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post('verify')
  async verify(@Body() body: VerifySessionParams): Promise<{ personId: string }> {
    const sessionToken = typeof body?.sessionToken === 'string' ? body.sessionToken : '';
    const personId = await this.sessions.verify(sessionToken);
    if (!personId) {
      throw new HttpException({ code: 'SESSION_INVALID', message: 'No live session answers this token.' }, HttpStatus.UNAUTHORIZED);
    }
    return { personId };
  }

  @Post('revoke')
  async revoke(@Body() body: VerifySessionParams): Promise<{ revoked: true }> {
    const sessionToken = typeof body?.sessionToken === 'string' ? body.sessionToken : '';
    if (!sessionToken) {
      throw new HttpException({ code: 'REQUEST_INVALID', message: 'sessionToken is required.' }, HttpStatus.BAD_REQUEST);
    }
    await this.sessions.revoke(sessionToken);
    return { revoked: true };
  }
}
