import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Lease } from "./lease.port"

/** Token of the Lease port. */
export const LEASE: unique symbol = Symbol("platform.lease")

/** Injects the Lease port. Parameter type: Lease. */
export const InjectLease = (): TypedParameterDecorator<Lease> => injector<Lease>(LEASE)
