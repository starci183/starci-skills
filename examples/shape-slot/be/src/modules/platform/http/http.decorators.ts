import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DeadlineScheduler } from "./deadline.port"

/** The response deadline scheduler. */
export const DEADLINE_SCHEDULER: unique symbol = Symbol("platform.http.deadline-scheduler")

/** Injects the cancellable response timer. Parameter type: DeadlineScheduler. */
export const InjectDeadlineScheduler = (): TypedParameterDecorator<DeadlineScheduler> =>
    injector<DeadlineScheduler>(DEADLINE_SCHEDULER)
