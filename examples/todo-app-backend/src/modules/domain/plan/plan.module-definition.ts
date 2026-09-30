import { ConfigurableModuleBuilder } from "@nestjs/common"
import { PLAN_OPTIONS } from "./plan.decorators"
import type { PlanOptions } from "./plan.options"

/** The configurable-module base of the plan capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PlanOptions>({ optionsInjectionToken: PLAN_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
