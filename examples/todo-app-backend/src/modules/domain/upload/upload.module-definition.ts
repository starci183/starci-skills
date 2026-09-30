import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { UploadOptions } from "./upload.options"

/** The configurable-module base of the upload capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<UploadOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
