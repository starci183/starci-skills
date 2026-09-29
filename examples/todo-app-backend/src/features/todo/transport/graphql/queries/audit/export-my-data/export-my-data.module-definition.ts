import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** ExportMyData takes no options beyond the isGlobal extra. */
export type ExportMyDataOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ExportMyDataOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
