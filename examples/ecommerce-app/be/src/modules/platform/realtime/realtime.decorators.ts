import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { RealtimeHub } from "./realtime.port"

/** Token of the RealtimeHub port. */
export const REALTIME_HUB: unique symbol = Symbol("platform.realtime.hub")

/** Injects the RealtimeHub port. Parameter type: RealtimeHub. */
export const InjectRealtimeHub = (): TypedParameterDecorator<RealtimeHub> => injector<RealtimeHub>(REALTIME_HUB)
