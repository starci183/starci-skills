/** A secret value (fixture brand). */
export class Secret {
    constructor(private readonly value: string) {}

    /** The plain value. */
    reveal(): string {
        return this.value
    }
}

/** An absolute URL (fixture brand). */
export type Url = string & { readonly __brand: "Url" }

/** The only reader of the process environment (fixture). */
export class EnvSource {
    /** A required string. */
    string(key: string): string {
        return key
    }

    /** A required secret. */
    secret(key: string): Secret {
        return new Secret(key)
    }

    /** A required URL. */
    url(key: string): Url {
        return key as Url
    }

    /** A required host. */
    host(key: string): string {
        return key
    }

    /** An optional key. */
    optional(key: string): string | undefined {
        return key || undefined
    }

    /** An integer with a tunable fallback. */
    int(key: string, fallback?: number): number {
        return fallback ?? Number(key)
    }
}
