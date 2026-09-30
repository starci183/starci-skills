/** The caller of an authenticated operation. */
export interface Principal {
    /** The caller id. */
    readonly id: string
}

/** The params of an authenticated operation. */
export interface ExecuteParams<T> {
    /** The mapped request. */
    readonly request: T
    /** The caller. */
    readonly principal: Principal
}

/** The params of a public operation. */
export interface PublicExecuteParams<T> {
    /** The mapped request. */
    readonly request: T
}
