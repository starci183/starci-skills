import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an upload whose content type is outside the configured allowlist. */
export interface UploadMimeNotAllowedExceptionMetadata extends DomainErrorMetadata {
  /** The content type that was refused. */
  mime?: string;
}

/** House refusal carrying code UPLOAD_MIME_NOT_ALLOWED_EXCEPTION; thrown at intake, before any byte is stored. */
export class UploadMimeNotAllowedException extends DomainError {
    constructor({ mime, ...metadata }: UploadMimeNotAllowedExceptionMetadata = {
    }) {
        super("UPLOAD_MIME_NOT_ALLOWED_EXCEPTION",
            "The upload's content type is not allowed.",
            {
                metadata: {
                    mime, ...metadata 
                } 
            })
    }
}
