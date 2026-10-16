/** The closed set of alternate credential families a door can accept. */
export type CredentialKind = "api-key" | "run-token" | "tool-token" | "link-token" | "posting" | "posting"

/** Alternate credentials accepted only by doors marked with `@Credential`. */
export interface CredentialMetadata {
    /** The credential family this door accepts. */
    readonly kind: CredentialKind
    /** An optional workflow constraint the authenticator may enforce for the credential. */
    readonly workflow?: string
}

/** A credential identity is deliberately separate from a signed-in user. */
export interface CredentialPrincipal {
    /** The credential family that established this identity. */
    readonly kind: CredentialKind
    /** The key, job, run or link the credential identifies. */
    readonly subject: string
    /** The only workspace this credential can act for. */
    readonly workspaceId: string
}

/** The port the app binds to the capability that owns credential verification. */
export interface CredentialAuthenticator {
    /** Authenticates the actual credential, throwing the owning domain's refusal on failure. */
    authenticate(metadata: CredentialMetadata, authorization: string, resourceId?: string): Promise<CredentialPrincipal>
}
