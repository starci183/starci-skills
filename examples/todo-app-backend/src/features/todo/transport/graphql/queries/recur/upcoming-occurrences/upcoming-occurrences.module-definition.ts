import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** UpcomingOccurrences takes no options beyond the isGlobal extra. */
export type UpcomingOccurrencesOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<UpcomingOccurrencesOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
