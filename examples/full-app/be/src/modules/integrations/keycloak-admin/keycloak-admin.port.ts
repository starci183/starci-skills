import type { Outcome } from "@modules/platform/primitives"
import type { KeycloakAdminErrorCode } from "./errors/keycloak-admin.error"
import type { CreatedMember, CreateMemberParams } from "./keycloak-admin.contracts"

/** The identity provider admin port: the only way product code writes a shopper into Keycloak. */
export interface KeycloakAdmin {
    /** Creates the shopper with the password, or the refusal: email taken, or the provider unavailable. */
    createMember(params: CreateMemberParams): Promise<Outcome<CreatedMember, KeycloakAdminErrorCode>>
}
