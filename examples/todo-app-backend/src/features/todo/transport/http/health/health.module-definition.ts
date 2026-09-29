import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Health takes no options beyond the isGlobal extra. */
export type HealthOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HealthOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
