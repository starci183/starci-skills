import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an upload that cannot be resolved. */
export interface UploadNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The upload id looked up. */
  uploadId?: string;
}

/** House refusal carrying code UPLOAD_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete id the lookup turned on. */
export class UploadNotFoundException extends AbstractException {
    constructor({ uploadId, ...metadata }: UploadNotFoundExceptionMetadata = {
    }) {
        super("The upload does not exist.",
            "UPLOAD_NOT_FOUND_EXCEPTION",
            {
                uploadId, ...metadata 
            })
    }
}
