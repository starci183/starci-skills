/**
 * Every domain and integration error in this example derives from AbstractException instead of a raw
 * Error or a bare Nest built-in. Transport adapters translate `code` into a protocol-specific status; the
 * domain and application layers never depend on that translation.
 *
 * This extends the native Error, as Nest's own exception handling and `instanceof Error` checks (Jest's
 * `.rejects.toThrow()` among them) depend on it. The checker fix on ex-checker no longer requires avoiding
 * the ambient ErrorConstructor surface to satisfy BE_PUBLIC_CONTRACT_FORM.
 */
export abstract class AbstractException extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;

  protected constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.context = context;
  }

  toString(): string {
    return `${this.name}: ${this.message}`;
  }
}
