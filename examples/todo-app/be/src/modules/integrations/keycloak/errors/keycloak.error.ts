import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the keycloak integration. */
export enum KeycloakErrorCode {
    /** The provider refused the credential pair; the code never says which half was wrong. */
    InvalidCredentials = "KEYCLOAK_INVALID_CREDENTIALS",
    /** The provider could not be reached or did not answer within the deadline. */
    ProviderUnavailable = "KEYCLOAK_PROVIDER_UNAVAILABLE",
}

/** How each keycloak code travels. */
export const KEYCLOAK_ERROR_KINDS: Record<KeycloakErrorCode, ErrorKind> = {
    [KeycloakErrorCode.InvalidCredentials]: "unauthenticated",
    [KeycloakErrorCode.ProviderUnavailable]: "unavailable",
}

/** The one error class of the keycloak integration. */
export class KeycloakError extends DomainError<KeycloakErrorCode> {}
