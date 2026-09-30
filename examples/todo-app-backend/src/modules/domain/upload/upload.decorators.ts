import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./upload.module-definition"
import type { UploadOptions } from "./upload.options"

/** Injects the options of the upload capability. Parameter type: UploadOptions. */
export const InjectUploadOptions = (): TypedParameterDecorator<UploadOptions> =>
    injector<UploadOptions>(MODULE_OPTIONS_TOKEN)
