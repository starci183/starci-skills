import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Outbox } from "./outbox.port"

/** Token of the Outbox port. */
export const OUTBOX: unique symbol = Symbol("platform.outbox")

/** Injects the Outbox port. Parameter type: Outbox. */
export const InjectOutbox = (): TypedParameterDecorator<Outbox> => injector<Outbox>(OUTBOX)
