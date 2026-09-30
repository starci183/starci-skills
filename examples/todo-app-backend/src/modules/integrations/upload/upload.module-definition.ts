import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Upload takes no options beyond the isGlobal extra. */
export type UploadOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<UploadOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
