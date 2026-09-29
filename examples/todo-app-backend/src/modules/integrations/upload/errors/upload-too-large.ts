import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an upload whose declared or received size crosses the configured ceiling. */
export interface UploadTooLargeExceptionMetadata extends DomainErrorMetadata {
  /** The size that was refused, in bytes. */
  sizeBytes?: number;
  /** The configured ceiling, in bytes. */
  maxBytes?: number;
}

/** House refusal carrying code UPLOAD_TOO_LARGE_EXCEPTION; thrown at intent time (declared size) and again at content time (received bytes), so a client cannot lie past the cap. */
export class UploadTooLargeException extends DomainError {
    constructor({ sizeBytes, maxBytes, ...metadata }: UploadTooLargeExceptionMetadata = {
    }) {
        super("UPLOAD_TOO_LARGE_EXCEPTION",
            "The upload exceeds the allowed size.",
            {
                metadata: {
                    sizeBytes, maxBytes, ...metadata 
                } 
            })
    }
}
