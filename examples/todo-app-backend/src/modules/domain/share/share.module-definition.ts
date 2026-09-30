import {
import { ModuleKind } from "@modules/platform/composition"
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Share takes no options beyond the isGlobal extra. */
export type ShareOptions = Record<never, never>

/** See databases/primary.module-definition.ts's comment: same isGlobal knob, every module. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ShareOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()

/** How the share module is composed: registered once at the app root and reached through injectors. */
export const SHARE_MODULE_KIND = ModuleKind.Capability
