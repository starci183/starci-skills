import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Collaborators takes no options beyond the isGlobal extra. */
export type CollaboratorsOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CollaboratorsOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
