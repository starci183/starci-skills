/** Options of the session capability. */
export interface IdentityOptions {
    /** How many days a session lives after sign-in. */
    readonly ttlDays: number
    /** The person ids the deployment trusts as administrators (the audit operator roster); empty means nobody. */
    readonly adminSubjects: ReadonlyArray<string>
}
