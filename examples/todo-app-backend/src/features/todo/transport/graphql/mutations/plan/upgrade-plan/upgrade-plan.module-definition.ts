import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** UpgradePlan takes no options beyond the isGlobal extra. */
export type UpgradePlanOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<UpgradePlanOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
