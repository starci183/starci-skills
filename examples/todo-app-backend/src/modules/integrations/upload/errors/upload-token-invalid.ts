import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a presigned PUT presented with a missing, expired or wrongly-signed token. */
export interface UploadTokenInvalidExceptionMetadata extends DomainErrorMetadata {
  /** The upload id the token was presented for. */
  uploadId?: string;
  /** Why the token was refused (missing, expired, signature, status). */
  reason?: string;
}

/** House refusal carrying code UPLOAD_TOKEN_INVALID_EXCEPTION; the presigned data-plane door's only refusal - an invalid token never reaches storage. */
export class UploadTokenInvalidException extends DomainError {
    constructor({ uploadId, reason, ...metadata }: UploadTokenInvalidExceptionMetadata = {
    }) {
        super("UPLOAD_TOKEN_INVALID_EXCEPTION",
            "The upload token is missing, expired or invalid.",
            {
                metadata: {
                    uploadId, reason, ...metadata 
                } 
            })
    }
}
