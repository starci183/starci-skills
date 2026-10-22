/** The person behind a live session, as the identity service names them. */
export interface IdentitySession {
    /** The person the token authenticates. */
    readonly personId: string
}

/** What verifying a session token answers: its session, or null when the identity service refuses the token. */
export type IdentitySessionLookup = IdentitySession | null

/** The GraphQL documents the order service sends to the identity service, checked against its published schema by the contract layer. */
export const IDENTITY_API_DOCUMENTS = {
    verifySession: "query VerifySession($input: VerifySessionInput!) { verifySession(input: $input) { personId } }",
} as const
