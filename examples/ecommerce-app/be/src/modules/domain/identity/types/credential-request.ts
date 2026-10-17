import type { OperationRequest } from "@modules/platform/http-security"
import type { CredentialPrincipal } from "../credential.contracts"

/** The request carrying a credential identity and an optional route resource id. */
export interface CredentialRequest extends OperationRequest {
    /** The identity established by the credential guard for this request. */
    credentialPrincipal?: CredentialPrincipal
    /** Route parameters used to constrain authentication to the requested resource. */
    readonly params?: CredentialRouteRequest
}

/** Route parameters relevant to credential authentication. */
export interface CredentialRouteRequest {
    /** The resource identifier supplied by the route, validated before authentication. */
    readonly id?: unknown
}
