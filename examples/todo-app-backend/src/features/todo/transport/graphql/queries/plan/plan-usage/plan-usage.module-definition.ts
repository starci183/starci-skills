import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** PlanUsage takes no options beyond the isGlobal extra. */
export type PlanUsageOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PlanUsageOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
