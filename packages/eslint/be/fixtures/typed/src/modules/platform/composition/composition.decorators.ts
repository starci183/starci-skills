import { Inject } from "@nestjs/common"
import type { InjectionToken } from "@nestjs/common"

/** A parameter decorator that remembers the type `T` it injects, so a lint rule can compare it with the parameter annotation. */
export type TypedParameterDecorator<T> = ParameterDecorator & {
    /** Never set at run time: it carries `T` so the lint rule can compare it with the parameter annotation. */
    readonly __injects?: T
}

/** Builds the parameter decorator that injects `token`, typed with the value it injects. Every `Inject<Thing>()` is built with it. */
export const injector = <T>(token: InjectionToken): TypedParameterDecorator<T> => Inject(token)
