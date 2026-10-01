/** The ids port: business code asks it for a new identifier instead of calling the ambient generator, so a spec can assert the exact id. */
export interface Ids {
    /** A new unique identifier. */
    next(): string
}
