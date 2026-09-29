import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** UpdateNotificationPreferences takes no options beyond the isGlobal extra. */
export type UpdateNotificationPreferencesOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<UpdateNotificationPreferencesOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
