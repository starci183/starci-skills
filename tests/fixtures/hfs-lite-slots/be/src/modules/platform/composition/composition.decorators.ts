import { Inject } from "@nestjs/common"
import type { InjectionToken } from "@nestjs/common"

/** Remembers the type injected by the named provider token. */
export type TypedParameterDecorator<T> = ParameterDecorator & { readonly __injects?: T }

/** Builds the typed injection decorator shared by the platform capabilities. */
export const injector = <T>(token: InjectionToken): TypedParameterDecorator<T> => Inject(token)
