import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a refused or failed reach to the upload object store. */
export interface UploadStorageUnavailableExceptionMetadata extends AbstractExceptionMetadata {
  /** Why the storage adapter refused or failed, stringified. */
  reason?: string;
}

/** House refusal carrying code UPLOAD_STORAGE_UNAVAILABLE_EXCEPTION; thrown when the storage adapter cannot honour a put/get/delete - including a storage key that would escape the upload root. */
export class UploadStorageUnavailableException extends AbstractException {
    constructor({ reason, ...metadata }: UploadStorageUnavailableExceptionMetadata) {
        super("The upload storage could not honour the request.",
            "UPLOAD_STORAGE_UNAVAILABLE_EXCEPTION",
            {
                reason, ...metadata 
            })
    }
}
