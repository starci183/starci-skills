/** Domain record read out of the session persistence row; the types service maps entities onto it. */
export class SessionRecord {
    constructor(
    readonly token: string,
    readonly personId: string,
    readonly issuedAt: Date,
    readonly expiresAt: Date,
    ) {}
}
