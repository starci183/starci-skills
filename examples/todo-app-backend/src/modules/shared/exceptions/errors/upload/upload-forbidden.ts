import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an upload the actor may not touch. */
export interface UploadForbiddenExceptionMetadata extends AbstractExceptionMetadata {
  /** The upload id the actor reached for. */
  uploadId?: string;
  /** The person who attempted the read/attach/delete. */
  actorId?: string;
}

/** House refusal carrying code UPLOAD_FORBIDDEN_EXCEPTION; thrown whenever an actor touches an upload row owned by somebody else. */
export class UploadForbiddenException extends AbstractException {
    constructor({ uploadId, actorId, ...metadata }: UploadForbiddenExceptionMetadata = {
    }) {
        super("The upload belongs to somebody else.",
            "UPLOAD_FORBIDDEN_EXCEPTION",
            {
                uploadId, actorId, ...metadata 
            })
    }
}
