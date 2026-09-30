/// <reference types="jest" />

/** The refusal a matcher expects: a capability code, or a code with the parameters of its display text. */
export type RefusalReason = string | { readonly code: string; readonly params?: Record<string, unknown> }

declare global {
  namespace jest {
    interface Matchers<R> {
      /** The received `Outcome` is `{ kind: "refused" }` with this code (and these params, when given). */
      toBeRefused(reason: RefusalReason): R
      /** The received `Outcome` is `{ kind: "ok" }` whose value equals `value` (recursive equality). */
      toSucceedWith(value: unknown): R
    }
  }
}

export declare const matchers: Record<"toBeRefused" | "toSucceedWith", (this: jest.MatcherContext, received: unknown, expected: unknown) => jest.CustomMatcherResult>
