/** The typed server configuration, validated once before the listener starts. */
export interface ServerOptions {
    /** TCP port the HTTP listener binds. */
    readonly port: number
}

/** Injection token under which the app module provides its {@link ServerOptions}. */
export const SERVER_OPTIONS = "SERVER_OPTIONS"
