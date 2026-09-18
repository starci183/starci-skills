import { AbstractException } from '../../platform/errors';

/**
 * br.login.password.sign-in requires that a refusal never names which half of the pair was wrong. Every
 * refusal path - a malformed email caught before Keycloak is asked, or Keycloak's own invalid_grant -
 * throws this exact exception, with the same message and the same code, so a transport mapper cannot leak
 * the difference even by accident.
 */
export class InvalidCredentialsException extends AbstractException {
  constructor() {
    super('The email or password is incorrect.', 'INVALID_CREDENTIALS');
  }
}

export class SessionNotFoundException extends AbstractException {
  constructor() {
    super('The session is not active.', 'SESSION_NOT_FOUND');
  }
}

export class SessionExpiredException extends AbstractException {
  constructor() {
    super('The session has expired.', 'SESSION_EXPIRED');
  }
}
