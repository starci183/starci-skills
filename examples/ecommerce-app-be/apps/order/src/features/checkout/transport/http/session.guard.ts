import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { IdentityApiClient } from '../../../../modules/integrations/identity';

export interface ActorParams {
  personId: string;
}

/**
 * Every checkout door runs through here: the bearer session token is verified against the
 * identity service over real HTTP (modules/integrations/identity), and the request only proceeds
 * carrying the person that verification named. An absent or refused token is this service's own
 * 401 (the consumer-obligation doctrine: propagate the refusal, never invent an actor); an
 * unreachable identity stays the 503 it was.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly identityApi: IdentityApiClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { actor?: ActorParams }>();
    const header = request.headers.authorization ?? '';
    const sessionToken = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!sessionToken) {
      throw new HttpException({ code: 'SESSION_INVALID', message: 'A Bearer session token is required.' }, HttpStatus.UNAUTHORIZED);
    }
    const verified = await this.identityApi.verifySession(sessionToken);
    if (!verified) {
      throw new HttpException({ code: 'SESSION_INVALID', message: 'No live session answers this token.' }, HttpStatus.UNAUTHORIZED);
    }
    request.actor = { personId: verified.personId };
    return true;
  }
}
