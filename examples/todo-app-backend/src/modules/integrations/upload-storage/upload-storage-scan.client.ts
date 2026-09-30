import { Injectable } from "@nestjs/common"
import type { ScanVerdict } from "./upload-storage.contracts"
import type { UploadScan } from "./upload-storage.port"

@Injectable()
/**
 * The shipped content inspection: an explicit pass-through that accepts every object. It keeps the hook real (the
 * handlers call it after every put and delete the stored bytes on a rejection) until a scanner replaces this binding.
 */
export class UploadScanClient implements UploadScan {
    /** Accepts the object; the port parameters are what a real scanner consumes. */
    scan(): Promise<ScanVerdict> {
        return Promise.resolve({ accepted: true })
    }
}
