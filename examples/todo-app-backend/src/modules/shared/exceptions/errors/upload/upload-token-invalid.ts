import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a presigned PUT presented with a missing, expired or wrongly-signed token. */
export interface UploadTokenInvalidExceptionMetadata extends AbstractExceptionMetadata {
  /** The upload id the token was presented for. */
  uploadId?: string;
  /** Why the token was refused (missing, expired, signature, status). */
  reason?: string;
}

/** House refusal carrying code UPLOAD_TOKEN_INVALID_EXCEPTION; the presigned data-plane door's only refusal - an invalid token never reaches storage. */
export class UploadTokenInvalidException extends AbstractException {
    constructor({ uploadId, reason, ...metadata }: UploadTokenInvalidExceptionMetadata = {
    }) {
        super("The upload token is missing, expired or invalid.",
            "UPLOAD_TOKEN_INVALID_EXCEPTION",
            {
                uploadId, reason, ...metadata 
            })
    }
}
