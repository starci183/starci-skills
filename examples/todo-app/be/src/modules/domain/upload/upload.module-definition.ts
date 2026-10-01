import { ConfigurableModuleBuilder } from "@nestjs/common"
import { UPLOAD_OPTIONS } from "./upload.decorators"
import type { UploadOptions } from "./upload.options"

/** The configurable-module base of the upload capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<UploadOptions>({ optionsInjectionToken: UPLOAD_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
