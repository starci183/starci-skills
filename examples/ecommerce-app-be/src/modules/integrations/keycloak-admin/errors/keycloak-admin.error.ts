import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the keycloak admin integration: what an admin lookup can be refused with. */
export enum KeycloakAdminErrorCode {
    /** The identity provider has no member with that id. */
    MemberMissing = "KEYCLOAK_ADMIN_MEMBER_MISSING",
    /** The identity provider could not be reached, timed out, failed or answered outside its contract. */
    Unavailable = "KEYCLOAK_ADMIN_UNAVAILABLE",
}

/** How each keycloak admin code travels. */
export const KEYCLOAK_ADMIN_ERROR_KINDS: Record<KeycloakAdminErrorCode, ErrorKind> = {
    [KeycloakAdminErrorCode.MemberMissing]: "not-found",
    [KeycloakAdminErrorCode.Unavailable]: "unavailable",
}

/** The one error class of the keycloak admin integration. */
export class KeycloakAdminError extends DomainError<KeycloakAdminErrorCode> {}
