import { UploadErrorCode } from "@modules/domain/upload"
import { UploadStorageError } from "@modules/integrations/upload"
import { refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"

/**
 * The refusal that tells a caller the storage plane is unavailable, for a failure of the storage integration; null for
 * any other failure, which the handler rethrows.
 */
export const toStorageRefusal = (
    error: unknown,
    uploadId: string,
): Outcome<never, UploadErrorCode.StorageUnavailable> | null =>
    error instanceof UploadStorageError ? refused(UploadErrorCode.StorageUnavailable, { uploadId }) : null
