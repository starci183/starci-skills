/** What issuing a session answers: the opaque bearer token and the person it authenticates. */
export interface IssuedSession {
    /** The opaque bearer token the client sends back. */
    readonly sessionToken: string
    /** The person the token authenticates. */
    readonly personId: string
}

/** The person behind a live bearer token. */
export interface LiveSession {
    /** The person the token authenticates. */
    readonly personId: string
}
