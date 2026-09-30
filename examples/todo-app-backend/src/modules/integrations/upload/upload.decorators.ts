import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./upload.module-definition"
import type { UploadStorageOptions } from "./upload.options"
import type { UploadScan, UploadStorage } from "./upload.port"

/** Token of the upload byte storage. */
export const UPLOAD_STORAGE: unique symbol = Symbol("integrations.upload.storage")

/** Token of the upload content inspection hook. */
export const UPLOAD_SCAN: unique symbol = Symbol("integrations.upload.scan")

/** Injects the upload byte storage. Parameter type: UploadStorage. */
export const InjectUploadStorage = (): TypedParameterDecorator<UploadStorage> =>
    injector<UploadStorage>(UPLOAD_STORAGE)

/** Injects the upload content inspection hook. Parameter type: UploadScan. */
export const InjectUploadScan = (): TypedParameterDecorator<UploadScan> => injector<UploadScan>(UPLOAD_SCAN)

/** Injects the options of the upload storage integration. Parameter type: UploadStorageOptions. */
export const InjectUploadStorageOptions = (): TypedParameterDecorator<UploadStorageOptions> =>
    injector<UploadStorageOptions>(MODULE_OPTIONS_TOKEN)
