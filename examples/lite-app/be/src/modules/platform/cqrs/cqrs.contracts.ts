/** The params of a public operation (no caller is identified): the request as the transport mapped it. */
export interface PublicExecuteParams<T> {
    /** The request mapped by the transport. */
    readonly request: T
}
