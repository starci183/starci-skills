import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** RevokeCollaborator takes no options beyond the isGlobal extra. */
export type RevokeCollaboratorOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RevokeCollaboratorOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
