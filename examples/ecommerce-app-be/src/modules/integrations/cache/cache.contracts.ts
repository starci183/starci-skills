/** A length of time. */
export interface Duration {
    /** The length in whole seconds. */
    readonly seconds: number
}

/** The declaration of one cached value: who owns it, how long it lives, where it is stored, and how a stored value is checked on the way out. */
export interface CacheKey<TValue> {
    /** The stable name, `<owner>.<key>`. */
    readonly name: string
    /** How long a stored value lives. */
    readonly ttl: Duration
    /** The store holding the value. */
    readonly store: "redis"
    /** Narrows the stored JSON to `TValue`, or answers null when it is not one; a null answer reads as a miss. */
    readonly parse: (stored: unknown) => TValue | null
}

/** Identifies one cached value: the declared key plus the arguments that make it unique (an id, a token). */
export interface CacheRequest<TValue> {
    /** The declared key. */
    readonly key: CacheKey<TValue>
    /** The arguments that make the entry unique. */
    readonly args: ReadonlyArray<string>
}
