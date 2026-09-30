import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./plan.module-definition"
import type { PlanOptions } from "./plan.options"

/** Token of the options of the plan capability. */
export const PLAN_OPTIONS = MODULE_OPTIONS_TOKEN

/** Injects the options of the plan capability. Parameter type: PlanOptions. */
export const InjectPlanOptions = (): TypedParameterDecorator<PlanOptions> => injector<PlanOptions>(PLAN_OPTIONS)
