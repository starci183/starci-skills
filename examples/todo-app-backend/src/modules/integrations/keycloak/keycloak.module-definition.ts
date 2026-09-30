import {
import { ModuleKind } from "@modules/platform/composition"
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

/** How the keycloak module is composed: registered once at the app root and reached through injectors. */
export const KEYCLOAK_MODULE_KIND = ModuleKind.Capability
