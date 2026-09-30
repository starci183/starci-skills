import { Inject } from "@nestjs/common"
import type { InjectionToken } from "@nestjs/common"
import { Reflector } from "@nestjs/core"

/** A parameter decorator that remembers the type `T` it injects, so a lint rule can compare it with the parameter annotation. */
export type TypedParameterDecorator<T> = ParameterDecorator & { readonly __injects?: T }

/** Builds the parameter decorator that injects `token`, typed with the value it injects. Every `Inject<Thing>()` is built with it. */
export const injector = <T>(token: InjectionToken): TypedParameterDecorator<T> => Inject(token)

/** Injects the framework Reflector that guards read handler metadata with. Parameter type: Reflector. */
export const InjectReflector = (): TypedParameterDecorator<Reflector> => injector<Reflector>(Reflector)
