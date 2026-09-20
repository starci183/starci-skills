import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an attach/read attempted against an upload whose content never arrived. */
export interface UploadNotReadyExceptionMetadata extends AbstractExceptionMetadata {
  /** The upload id still waiting for its bytes. */
  uploadId?: string;
}

/** House refusal carrying code UPLOAD_NOT_READY_EXCEPTION; a pending intent cannot be attached, read or treated as stored - only the presigned PUT (or a retry of it) moves it to ready. */
export class UploadNotReadyException extends AbstractException {
    constructor({ uploadId, ...metadata }: UploadNotReadyExceptionMetadata = {
    }) {
        super("The upload has no stored content yet.",
            "UPLOAD_NOT_READY_EXCEPTION",
            {
                uploadId, ...metadata 
            })
    }
}
