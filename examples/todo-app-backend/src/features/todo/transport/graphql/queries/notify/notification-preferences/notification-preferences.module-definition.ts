import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** NotificationPreferences takes no options beyond the isGlobal extra. */
export type NotificationPreferencesOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<NotificationPreferencesOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
