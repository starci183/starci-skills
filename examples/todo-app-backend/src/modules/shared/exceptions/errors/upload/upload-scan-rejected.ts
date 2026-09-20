import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an upload the scan hook refused. */
export interface UploadScanRejectedExceptionMetadata extends AbstractExceptionMetadata {
  /** The upload id the verdict was about. */
  uploadId?: string;
  /** The scanner's stated reason, when it gives one. */
  reason?: string;
}

/** House refusal carrying code UPLOAD_SCAN_REJECTED_EXCEPTION; thrown only from inside the VirusScanPort contract - a rejected object is deleted from storage and the row stays pending. */
export class UploadScanRejectedException extends AbstractException {
    constructor({ uploadId, reason, ...metadata }: UploadScanRejectedExceptionMetadata = {
    }) {
        super("The upload was rejected by the content scan.",
            "UPLOAD_SCAN_REJECTED_EXCEPTION",
            {
                uploadId, reason, ...metadata 
            })
    }
}
