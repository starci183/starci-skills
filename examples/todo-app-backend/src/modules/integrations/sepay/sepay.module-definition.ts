import {
import { ModuleKind } from "@modules/platform/composition"
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Sepay takes no options beyond the isGlobal extra. */
export type SepayOptions = Record<never, never>

/** See primary.module-definition.ts's comment: nivo gives every owned module this same isGlobal knob. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SepayOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()

/** How the sepay module is composed: registered once at the app root and reached through injectors. */
export const SEPAY_MODULE_KIND = ModuleKind.Capability
