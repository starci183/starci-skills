import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an upload the scan hook refused. */
export interface UploadScanRejectedExceptionMetadata extends DomainErrorMetadata {
  /** The upload id the verdict was about. */
  uploadId?: string;
  /** The scanner's stated reason, when it gives one. */
  reason?: string;
}

/** House refusal carrying code UPLOAD_SCAN_REJECTED_EXCEPTION; thrown only from inside the VirusScanPort contract - a rejected object is deleted from storage and the row stays pending. */
export class UploadScanRejectedException extends DomainError {
    constructor({ uploadId, reason, ...metadata }: UploadScanRejectedExceptionMetadata = {
    }) {
        super("UPLOAD_SCAN_REJECTED_EXCEPTION",
            "The upload was rejected by the content scan.",
            {
                metadata: {
                    uploadId, reason, ...metadata 
                } 
            })
    }
}
