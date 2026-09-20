import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an upload whose content type is outside the configured allowlist. */
export interface UploadMimeNotAllowedExceptionMetadata extends AbstractExceptionMetadata {
  /** The content type that was refused. */
  mime?: string;
}

/** House refusal carrying code UPLOAD_MIME_NOT_ALLOWED_EXCEPTION; thrown at intake, before any byte is stored. */
export class UploadMimeNotAllowedException extends AbstractException {
    constructor({ mime, ...metadata }: UploadMimeNotAllowedExceptionMetadata = {
    }) {
        super("The upload's content type is not allowed.",
            "UPLOAD_MIME_NOT_ALLOWED_EXCEPTION",
            {
                mime, ...metadata 
            })
    }
}
