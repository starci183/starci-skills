import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { UploadStorageOptions } from "./upload-storage.options"
import type { UploadScan, UploadStorage } from "./upload-storage.port"

/** Token of the upload byte storage. */
export const UPLOAD_STORAGE: unique symbol = Symbol("integrations.upload-storage.storage")

/** Token of the upload content inspection hook. */
export const UPLOAD_SCAN: unique symbol = Symbol("integrations.upload-storage.scan")

/** Injects the upload byte storage. Parameter type: UploadStorage. */
export const InjectUploadStorage = (): TypedParameterDecorator<UploadStorage> => injector<UploadStorage>(UPLOAD_STORAGE)

/** Injects the upload content inspection hook. Parameter type: UploadScan. */
export const InjectUploadScan = (): TypedParameterDecorator<UploadScan> => injector<UploadScan>(UPLOAD_SCAN)

/** Token of the upload storage options, exported so a spec can provide it. */
export const UPLOAD_STORAGE_OPTIONS: unique symbol = Symbol("integrations.upload-storage.options")

/** Injects the options of the upload storage integration. Parameter type: UploadStorageOptions. */
export const InjectUploadStorageOptions = (): TypedParameterDecorator<UploadStorageOptions> =>
    injector<UploadStorageOptions>(UPLOAD_STORAGE_OPTIONS)
