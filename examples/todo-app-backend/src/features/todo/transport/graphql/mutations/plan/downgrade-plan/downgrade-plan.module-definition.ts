import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** DowngradePlan takes no options beyond the isGlobal extra. */
export type DowngradePlanOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DowngradePlanOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
