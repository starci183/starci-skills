/** The verified caller admitted by the default-deny guard. */
export interface Principal {
    /** The provider's stable user identifier. */
    readonly id: string
    /** The verified email claim when the provider issued one. */
    readonly email?: string
    /** The authenticated provider role. */
    readonly role: "authenticated"
}

/** The params of an authenticated operation: its mapped request and verified caller. */
export interface ExecuteParams<T> {
    /** The request mapped by the transport. */
    readonly request: T
    /** The caller established by the guard. */
    readonly principal: Principal
}

/** The params of a public operation (no caller is identified): the request as the transport mapped it. */
export interface PublicExecuteParams<T> {
    /** The request mapped by the transport. */
    readonly request: T
}
