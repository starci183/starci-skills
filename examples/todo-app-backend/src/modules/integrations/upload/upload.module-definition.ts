import {
import { ModuleKind } from "@modules/platform/composition"
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Upload takes no options beyond the isGlobal extra. */
export type UploadOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<UploadOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()

/** How the upload module is composed: registered once at the app root and reached through injectors. */
export const UPLOAD_MODULE_KIND = ModuleKind.Capability
