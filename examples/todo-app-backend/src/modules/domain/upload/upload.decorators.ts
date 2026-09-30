import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./upload.module-definition"
import type { UploadOptions } from "./upload.options"

/** Token of the upload options, exported so a spec can provide it. */
export const UPLOAD_OPTIONS = MODULE_OPTIONS_TOKEN

/** Injects the options of the upload capability. Parameter type: UploadOptions. */
export const InjectUploadOptions = (): TypedParameterDecorator<UploadOptions> =>
    injector<UploadOptions>(UPLOAD_OPTIONS)
