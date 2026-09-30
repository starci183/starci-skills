/** The roles a principal can hold. */
export type Role = "member" | "admin"

/** The authenticated caller of an operation: entities never travel in a command, only this identity. */
export interface Principal {
    /** The stable id of the caller. */
    readonly id: string
    /** The roles the caller holds. */
    readonly roles: ReadonlyArray<Role>
}

/** The params of an authenticated operation: the transport-mapped request and the caller. */
export interface ExecuteParams<T> {
    /** The request mapped by the transport. */
    readonly request: T
    /** The authenticated caller. */
    readonly principal: Principal
}

/** The params of a `@Public` operation: there is no principal, and the type says so. */
export interface PublicExecuteParams<T> {
    /** The request mapped by the transport. */
    readonly request: T
}
