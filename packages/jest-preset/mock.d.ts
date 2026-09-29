/// <reference types="jest" />

/** Function members become jest mocks typed against the real signature; everything else stays as declared. */
export type MockOf<T> = T & {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? jest.Mock<R, A> & T[K] : T[K]
}

/** A typed test double for `T`. `overrides` may be partial; the result is usable wherever a `T` is required. */
export declare function mock<T extends object>(overrides?: Partial<T>): MockOf<T>

/** The factory behind `mock`, for callers that bring their own function factory (used by the package spec). */
export declare function createMock(makeFn: () => unknown): <T extends object>(overrides?: Partial<T>) => MockOf<T>
