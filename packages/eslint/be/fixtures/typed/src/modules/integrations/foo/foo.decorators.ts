import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { FooClient } from "./foo.client"

/** Token of the Foo client. */
export const FOO: unique symbol = Symbol("integrations.foo")

/** Injects the Foo client. Parameter type: FooClient. */
export const InjectFoo = (): TypedParameterDecorator<FooClient> => injector<FooClient>(FOO)
