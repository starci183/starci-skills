import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Recur takes no options beyond the isGlobal extra. */
export type RecurOptions = Record<never, never>

/** Same isGlobal knob every capability module's module-definition.ts declares. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RecurOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
