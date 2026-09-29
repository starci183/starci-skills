import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** EditRecurrence takes no options beyond the isGlobal extra. */
export type EditRecurrenceOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<EditRecurrenceOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
