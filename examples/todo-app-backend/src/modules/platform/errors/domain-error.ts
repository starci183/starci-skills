/** Extra debugging fields a throw site attaches to an error; the index signature lets a call site name any field without a cast. */
export interface DomainErrorMetadata {
    [key: string]: unknown
}

/** What a capability error passes up: the failure that caused it, and the fields that make it queryable. */
export interface DomainErrorOptions {
    readonly cause?: unknown
    readonly metadata?: DomainErrorMetadata
}

/** The base of every error a capability declares: a stable machine code, a sentence for people, the cause and metadata. */
export abstract class DomainError extends Error {
    /** Stable machine code that transports map to a status and logs group by. */
    readonly code: string

    /** Extra debugging metadata; an empty object when the throw site attached none. */
    readonly metadata: DomainErrorMetadata

    protected constructor(code: string, message: string, options: DomainErrorOptions = {
    }) {
        super(message,
            options.cause === undefined ? undefined : {
                cause: options.cause 
            })
        this.name = new.target.name
        this.code = code
        this.metadata = options.metadata ?? {
        }
    }
}
