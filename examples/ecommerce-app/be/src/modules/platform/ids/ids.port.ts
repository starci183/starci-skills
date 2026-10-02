/** The ids port: business code asks it for a new identifier instead of reading a random source, so a spec can say every id. */
export interface Ids {
    /** A new unique identifier (a UUID). */
    next(): string
}
