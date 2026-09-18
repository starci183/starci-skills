import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

export type KeycloakInvalidCredentialsExceptionMetadata = AbstractExceptionMetadata;

/**
 * The provider's own refusal, translated at the integration boundary into this module's public
 * contract. br.login.password.sign-in requires that the caller cannot tell, from this exception alone,
 * whether the email was unknown or the password was wrong: Keycloak's direct access grant already
 * returns the same invalid_grant refusal for both, so translating it one-to-one preserves that property.
 */
export class KeycloakInvalidCredentialsException extends AbstractException {
  constructor(metadata: KeycloakInvalidCredentialsExceptionMetadata = {}) {
    super('Keycloak refused the credential pair.', 'KEYCLOAK_INVALID_CREDENTIALS', metadata);
  }
}
