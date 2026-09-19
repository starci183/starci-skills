import {
    HttpException, HttpStatus 
} from "@nestjs/common"

/**
 * The house base every exception in this application extends (nivo's shared exceptions doctrine,
 * adapted to a REST deployable): a failure carries a stable machine code, the human message and a
 * metadata object - never a bare `Error` and never a framework exception whose only identity is a
 * status code. Extending HttpException keeps the transport contract Nest already speaks: the door
 * answers `getStatus()` with `getResponse()` as the body, which is exactly the flat
 * `{ code, message, ...metadata }` envelope the public refusal contract publishes.
 */
export abstract class AbstractException extends HttpException {
    /** The stable code a client matches on - derived from the class name, stated as a literal. */
    readonly code: string
    /** Extra debugging metadata the throw site attached (ids, counts, the original error). */
    readonly metadata?: Record<string, unknown>

    /**
     * @param message - Human readable message, also spread into the response body.
     * @param name - The exception code, kept as `Error.name` as well.
     * @param metadata - Fields spread into the response body beside code and message.
     * @param httpStatus - The status the answering door reports.
     */
    protected constructor(message: string, name: string, metadata: Record<string, unknown>, httpStatus: HttpStatus) {
        super({
            code: name, message, ...metadata 
        },
        httpStatus)
        this.message = message
        this.code = name
        this.name = name
        this.metadata = metadata
    }

    /** Serialize the exception for transport/logging. */
    toJSON(): string {
        return JSON.stringify({
            message: this.message, code: this.code, metadata: this.metadata 
        })
    }

    /** The underlying error when the throw site attached one under `metadata.originalError`. */
    getOriginalError(): Error {
        return this.metadata?.originalError as Error
    }
}

/**
 * Additional metadata for exception instances (e.g. originalError). Widened with a string index
 * signature so a call site can attach any extra debugging field - every subclass under
 * `exceptions/errors/**` extends this interface with its own named fields.
 */
export interface AbstractExceptionMetadata {
  /** The underlying error that triggered this exception. */
  originalError?: Error;
  /** Any other debugging metadata a subclass or call site attaches. */
  [key: string]: unknown;
}
