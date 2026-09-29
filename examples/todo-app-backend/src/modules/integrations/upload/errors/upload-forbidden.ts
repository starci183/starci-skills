import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an upload the actor may not touch. */
export interface UploadForbiddenExceptionMetadata extends DomainErrorMetadata {
  /** The upload id the actor reached for. */
  uploadId?: string;
  /** The person who attempted the read/attach/delete. */
  actorId?: string;
}

/** House refusal carrying code UPLOAD_FORBIDDEN_EXCEPTION; thrown whenever an actor touches an upload row owned by somebody else. */
export class UploadForbiddenException extends DomainError {
    constructor({ uploadId, actorId, ...metadata }: UploadForbiddenExceptionMetadata = {
    }) {
        super("UPLOAD_FORBIDDEN_EXCEPTION",
            "The upload belongs to somebody else.",
            {
                metadata: {
                    uploadId, actorId, ...metadata 
                } 
            })
    }
}
