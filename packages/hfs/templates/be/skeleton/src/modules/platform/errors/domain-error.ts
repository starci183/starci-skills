/** The base of every error a capability declares: a stable machine code, a sentence for people, and the cause. */
export abstract class DomainError extends Error {
    /** Stable machine code that transports map to a status and logs group by. */
    readonly code: string

    constructor(code: string, message: string, options?: { readonly cause?: unknown }) {
        super(message, options)
        this.name = new.target.name
        this.code = code
    }
}
