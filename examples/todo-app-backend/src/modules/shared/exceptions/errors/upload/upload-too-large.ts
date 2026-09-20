import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an upload whose declared or received size crosses the configured ceiling. */
export interface UploadTooLargeExceptionMetadata extends AbstractExceptionMetadata {
  /** The size that was refused, in bytes. */
  sizeBytes?: number;
  /** The configured ceiling, in bytes. */
  maxBytes?: number;
}

/** House refusal carrying code UPLOAD_TOO_LARGE_EXCEPTION; thrown at intent time (declared size) and again at content time (received bytes), so a client cannot lie past the cap. */
export class UploadTooLargeException extends AbstractException {
    constructor({ sizeBytes, maxBytes, ...metadata }: UploadTooLargeExceptionMetadata = {
    }) {
        super("The upload exceeds the allowed size.",
            "UPLOAD_TOO_LARGE_EXCEPTION",
            {
                sizeBytes, maxBytes, ...metadata 
            })
    }
}
