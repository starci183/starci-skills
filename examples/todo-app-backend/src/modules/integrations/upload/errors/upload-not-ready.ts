import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an attach/read attempted against an upload whose content never arrived. */
export interface UploadNotReadyExceptionMetadata extends DomainErrorMetadata {
  /** The upload id still waiting for its bytes. */
  uploadId?: string;
}

/** House refusal carrying code UPLOAD_NOT_READY_EXCEPTION; a pending intent cannot be attached, read or treated as stored - only the presigned PUT (or a retry of it) moves it to ready. */
export class UploadNotReadyException extends DomainError {
    constructor({ uploadId, ...metadata }: UploadNotReadyExceptionMetadata = {
    }) {
        super("UPLOAD_NOT_READY_EXCEPTION",
            "The upload has no stored content yet.",
            {
                metadata: {
                    uploadId, ...metadata 
                } 
            })
    }
}
