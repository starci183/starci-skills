/**
 * Base abstract exception class for all custom exceptions.
 * All exceptions in the application should extend this class.
 */
export class AbstractException extends Error {
    /** Unique error code for identification. */
    readonly code: string
    /** Additional metadata for debugging. */
    readonly metadata?: Record<string, unknown>
    /**
     * Optional HTTP status for REST boundaries. Undefined means 500 at both
     * transports unless a host filter chooses another default.
     */
    readonly httpStatus?: number

    /**
     * @param message - Human readable message.
     * @param name - Exception code (also assigned to Error.name).
     * @param metadata - Extra debugging metadata.
     * @param httpStatus - Optional HTTP status override for REST responses.
     */
    constructor(
        message: string,
        name: string,
        metadata?: Record<string, unknown>,
        httpStatus?: number,
    ) {
        super(message)
        this.code = name
        this.name = name
        this.metadata = metadata
        this.httpStatus = httpStatus
    }

    /** Convert the exception to a JSON string. */
    toJSON(): string {
        return JSON.stringify({
            message: this.message,
            code: this.code,
            metadata: this.metadata,
        })
    }

    /**
     * Create an exception from a JSON string.
     *
     * @param json - The JSON string.
     * @returns The exception instance.
     */
    static fromJSON<T extends AbstractException>(
        this: new (
            message: string,
            code: string,
            metadata?: Record<string, unknown>,
        ) => T,
        json: string,
    ): T {
        const {
            message,
            code,
            metadata,
        } = JSON.parse(json)
        return new this(
            message,
            code,
            metadata,
        )
    }

    /** Get the original error from metadata when present. */
    getOriginalError(): Error {
        return this.metadata?.originalError as Error
    }
}

/** Additional metadata for exception instances (for example originalError). */
export interface AbstractExceptionMetadata {
    originalError?: Error
}
