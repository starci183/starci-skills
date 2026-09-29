import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** MakeRecurring takes no options beyond the isGlobal extra. */
export type MakeRecurringOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MakeRecurringOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
