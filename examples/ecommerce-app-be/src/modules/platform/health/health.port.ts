/** One dependency the service reports on: the database, the cache, another service. */
export interface HealthProbe {
    /** The name the health report lists this dependency under. */
    readonly name: string
    /** Resolves when the dependency answers, rejects when it does not. */
    check(): Promise<void>
}
