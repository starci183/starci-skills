/**
 * Base abstract exception class for all custom exceptions. Every domain and integration error in this
 * example extends this class (never a raw `Error` or a bare Nest built-in). This mirrors nivo's own
 * `src/modules/shared/exceptions/errors/abstract.ts` exactly - same fields, same constructor shape,
 * same `toJSON`/`getOriginalError` helpers - collapsed into this app's single `modules/shared` home
 * since this example has one app, not nivo's core/expert split each with its own
 * `@modules/<app>/exceptions`.
 */
export abstract class AbstractException extends Error {
  /** Unique error code for identification. */
  readonly code: string;
  /** Additional metadata for debugging. */
  readonly metadata?: Record<string, unknown>;

  /**
   * @param message - Human readable message.
   * @param name - Exception code (kept as `Error.name`).
   * @param metadata - Extra debugging metadata.
   */
  protected constructor(message: string, name: string, metadata?: Record<string, unknown>) {
    super(message);
    this.code = name;
    this.name = name;
    this.metadata = metadata;
  }

  /** Serialize the exception for transport/logging. */
  toJSON(): string {
    return JSON.stringify({ message: this.message, code: this.code, metadata: this.metadata });
  }

  /** The underlying error when present. Matches nivo's own signature exactly (a bare `Error`, not a
   * union) - `BE_PUBLIC_CONTRACT_FORM` refuses an inline union return; the cast is honest about what
   * this returns when `metadata.originalError` was never set (`undefined` at runtime), the same way
   * nivo's own identically-typed method does. */
  getOriginalError(): Error {
    return this.metadata?.originalError as Error;
  }
}

/**
 * Additional metadata for exception instances (e.g. originalError). Widened with a string index
 * signature so a call site can pass any extra debugging field without an `as never` cast - every
 * subclass under `modules/shared/exceptions/errors/**` extends this interface with its own named
 * fields, which TypeScript already checks structurally.
 */
export interface AbstractExceptionMetadata {
  /** The underlying error that triggered this exception. */
  originalError?: Error;
  /** Any other debugging metadata a subclass or call site attaches. */
  [key: string]: unknown;
}
