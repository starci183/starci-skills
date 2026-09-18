import { AbstractException } from '../../platform/errors';

export class KeycloakUnavailableException extends AbstractException {
  constructor(reason: string) {
    super('The identity provider could not be reached.', 'KEYCLOAK_UNAVAILABLE', { reason });
  }
}
