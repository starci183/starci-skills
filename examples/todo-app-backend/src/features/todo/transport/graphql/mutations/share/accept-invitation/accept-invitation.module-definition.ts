import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** AcceptInvitation takes no options beyond the isGlobal extra. */
export type AcceptInvitationOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AcceptInvitationOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
