import {
import { ModuleKind } from "@modules/platform/composition"
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Recur takes no options beyond the isGlobal extra. */
export type RecurOptions = Record<never, never>

/** Same isGlobal knob every capability module's module-definition.ts declares. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RecurOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()

/** How the recur module is composed: registered once at the app root and reached through injectors. */
export const RECUR_MODULE_KIND = ModuleKind.Capability
