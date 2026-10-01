/** What issuing a session answers: the opaque bearer token and the person it authenticates. */
export interface IssuedSession {
    /** The opaque bearer token the client sends back. */
    readonly sessionToken: string
    /** The person the token authenticates. */
    readonly personId: string
}

/** What issuing a session needs. */
export interface IssueSessionParams {
    /** The person the session authenticates. */
    readonly personId: string
}

/** The session behind a token, or null when the token has none. */
export type SessionLookupResult = LiveSession | null

/** The person behind a live bearer token. */
export interface LiveSession {
    /** The person the token authenticates. */
    readonly personId: string
}

/** What ending the own session of a person needs. */
export interface RevokeOwnSessionParams {
    /** The person who must own the session. */
    readonly personId: string
    /** The opaque bearer token of the session to end. */
    readonly sessionToken: string
}

/** The confirmation that the session ended. */
export interface RevokedSession {
    /** Always true: a refusal is the other half of the outcome. */
    readonly revoked: true
}
