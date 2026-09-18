import { AbstractException } from '../../platform/errors';

/**
 * The provider's own refusal is translated here, at the integration boundary, into this module's public
 * contract. br.login.password.sign-in requires that the caller cannot tell, from this exception alone,
 * whether the email was unknown or the password was wrong: Keycloak's direct access grant already returns
 * the same invalid_grant refusal for both, so translating it one-to-one preserves that property for free.
 */
export class KeycloakInvalidCredentialsException extends AbstractException {
  constructor() {
    super('Keycloak refused the credential pair.', 'KEYCLOAK_INVALID_CREDENTIALS');
  }
}

export class KeycloakUnavailableException extends AbstractException {
  constructor(detail: string) {
    super('Keycloak could not be reached.', 'KEYCLOAK_UNAVAILABLE', { detail });
  }
}
