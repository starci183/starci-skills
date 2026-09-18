/**
 * Every domain and integration error in this example derives from AbstractException instead of a raw
 * Error or a bare Nest built-in. Transport adapters translate `code` into a protocol-specific status; the
 * domain and application layers never depend on that translation.
 *
 * This deliberately does not extend the native Error: doing so drags the ambient Node ErrorConstructor
 * static surface (captureStackTrace, prepareStackTrace, stackTraceLimit) onto every subclass, and
 * prepareStackTrace's declared `any` return type cannot satisfy BE_PUBLIC_CONTRACT_FORM. This carries the
 * same three fields every consumer actually reads (message, code, context) without that ambient surface.
 */
export abstract class AbstractException {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly context?: Record<string, unknown>;

  protected constructor(message: string, code: string, context?: Record<string, unknown>) {
    this.name = new.target.name;
    this.message = message;
    this.code = code;
    this.context = context;
  }

  toString(): string {
    return `${this.name}: ${this.message}`;
  }
}
