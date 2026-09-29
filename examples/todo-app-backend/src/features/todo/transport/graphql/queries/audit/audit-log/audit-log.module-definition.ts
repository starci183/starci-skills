import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** AuditLog takes no options beyond the isGlobal extra. */
export type AuditLogOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AuditLogOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
