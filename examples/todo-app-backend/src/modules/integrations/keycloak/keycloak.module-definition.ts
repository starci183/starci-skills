import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Keycloak takes no options beyond the isGlobal extra. */
export type KeycloakOptions = Record<never, never>

/** See primary.module-definition.ts's comment: nivo gives every owned module this same isGlobal knob. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<KeycloakOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
