import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the keycloak admin integration: what creating a shopper can be refused with. */
export enum KeycloakAdminErrorCode {
    /** The realm already holds a user with that email. */
    EmailTaken = "KEYCLOAK_ADMIN_EMAIL_TAKEN",
    /** The identity provider could not be reached, timed out, failed or answered outside its contract. */
    Unavailable = "KEYCLOAK_ADMIN_UNAVAILABLE",
}

/** How each keycloak admin code travels. */
export const KEYCLOAK_ADMIN_ERROR_KINDS: Record<KeycloakAdminErrorCode, ErrorKind> = {
    [KeycloakAdminErrorCode.EmailTaken]: "conflict",
    [KeycloakAdminErrorCode.Unavailable]: "unavailable",
}

/** The one error class of the keycloak admin integration. */
export class KeycloakAdminError extends DomainError<KeycloakAdminErrorCode> {}
