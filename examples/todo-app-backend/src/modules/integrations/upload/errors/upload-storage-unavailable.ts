import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a refused or failed reach to the upload object store. */
export interface UploadStorageUnavailableExceptionMetadata extends DomainErrorMetadata {
  /** Why the storage adapter refused or failed, stringified. */
  reason?: string;
}

/** House refusal carrying code UPLOAD_STORAGE_UNAVAILABLE_EXCEPTION; thrown when the storage adapter cannot honour a put/get/delete - including a storage key that would escape the upload root. */
export class UploadStorageUnavailableException extends DomainError {
    constructor({ reason, ...metadata }: UploadStorageUnavailableExceptionMetadata) {
        super("UPLOAD_STORAGE_UNAVAILABLE_EXCEPTION",
            "The upload storage could not honour the request.",
            {
                metadata: {
                    reason, ...metadata 
                } 
            })
    }
}
