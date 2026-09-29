import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Invite takes no options beyond the isGlobal extra. */
export type InviteOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InviteOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
