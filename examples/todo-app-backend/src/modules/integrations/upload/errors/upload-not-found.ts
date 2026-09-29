import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an upload that cannot be resolved. */
export interface UploadNotFoundExceptionMetadata extends DomainErrorMetadata {
  /** The upload id looked up. */
  uploadId?: string;
}

/** House refusal carrying code UPLOAD_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete id the lookup turned on. */
export class UploadNotFoundException extends DomainError {
    constructor({ uploadId, ...metadata }: UploadNotFoundExceptionMetadata = {
    }) {
        super("UPLOAD_NOT_FOUND_EXCEPTION",
            "The upload does not exist.",
            {
                metadata: {
                    uploadId, ...metadata 
                } 
            })
    }
}
