import { SEPAY_ERROR_KINDS, SepayError } from "@modules/integrations/sepay"
import { UPLOAD_STORAGE_ERROR_KINDS, UploadStorageError } from "@modules/integrations/upload"
import type { ErrorParams } from "@modules/platform/errors"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

type SepayCode = ConstructorParameters<typeof SepayError>[0]["code"]
type StorageCode = ConstructorParameters<typeof UploadStorageError>[0]["code"]

const isRequestFailed = (code: string): code is SepayCode => code === "SEPAY_REQUEST_FAILED"
const isStorageFailed = (code: string): code is StorageCode => code === "UPLOAD_STORAGE_FAILED"

/** The error a failed SePay gateway call raises, built from the public kind table of the integration. */
export const sepayRequestFailure = (params: ErrorParams): SepayError => {
    const code = Object.keys(SEPAY_ERROR_KINDS).find(isRequestFailed)
    if (code === undefined)
        throw new TestWorldError({
            code: TestWorldErrorCode.KindMissing,
            params: { detail: "SePay request-failed code is missing from the public kind table" },
        })
    return new SepayError({ code, params })
}

/** The error a failed upload storage call raises, built from the public kind table of the integration. */
export const storageFailure = (): UploadStorageError => {
    const code = Object.keys(UPLOAD_STORAGE_ERROR_KINDS).find(isStorageFailed)
    if (code === undefined)
        throw new TestWorldError({
            code: TestWorldErrorCode.KindMissing,
            params: { detail: "upload storage failed code is missing from the public kind table" },
        })
    return new UploadStorageError({ code })
}
