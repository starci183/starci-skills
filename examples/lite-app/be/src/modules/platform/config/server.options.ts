/** The typed server configuration, validated once before the listener starts. */
export interface ServerOptions {
    /** TCP port the HTTP listener binds. */
    readonly port: number
}
