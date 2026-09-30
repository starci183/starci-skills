import type { Outcome } from "@modules/platform/primitives"
import type { KeycloakAdminErrorCode } from "./errors/keycloak-admin.error"
import type { KeycloakMember } from "./keycloak-admin.contracts"

/** The identity provider admin port: the only way product code reads a member from Keycloak. */
export interface KeycloakAdmin {
    /** The member with `memberId`, or the refusal: missing when the provider has none, unavailable when it cannot answer. */
    findMember(memberId: string): Promise<Outcome<KeycloakMember, KeycloakAdminErrorCode>>
}
