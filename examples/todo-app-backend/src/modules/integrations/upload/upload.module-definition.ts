import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { UploadStorageOptions } from "./upload.options"

/** The configurable-module base of the upload storage integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<UploadStorageOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
