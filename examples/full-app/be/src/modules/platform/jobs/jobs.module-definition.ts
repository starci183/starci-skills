import { ConfigurableModuleBuilder } from "@nestjs/common"
import { JOBS_OPTIONS } from "./jobs.decorators"
import type { JobsOptions } from "./jobs.options"

/** The configurable-module base of the jobs; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<JobsOptions>({
    optionsInjectionToken: JOBS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
