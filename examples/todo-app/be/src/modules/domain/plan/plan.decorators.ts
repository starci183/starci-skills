import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { PlanOptions } from "./plan.options"

/** Token of the options of the plan capability. */
export const PLAN_OPTIONS: unique symbol = Symbol("domain.plan.options")

/** Injects the options of the plan capability. Parameter type: PlanOptions. */
export const InjectPlanOptions = (): TypedParameterDecorator<PlanOptions> => injector<PlanOptions>(PLAN_OPTIONS)
