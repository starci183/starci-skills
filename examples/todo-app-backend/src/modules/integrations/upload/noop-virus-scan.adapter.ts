import {
    Injectable 
} from "@nestjs/common"
import {
    VirusScanPort 
} from "./upload.contracts"

/**
 * The explicit pass-through behind VirusScanPort: every stored object is accepted. The contract it
 * satisfies is real even though the verdict is unconditional - UploadService calls scan() after every
 * put and before the row flips to ready, honours an UploadScanRejectedException by deleting the object
 * and leaving the row pending, and treats any other throw as an infrastructure failure. A real
 * scanner (ClamAV over a socket, a provider's tagging flow) replaces this binding in upload.module.ts
 * without touching the service, the door or the record.
 */
@Injectable()
/** No-op VirusScanPort - accepts every object; the seam, not the verdict, is what this slice ships. */
export class NoopVirusScanAdapter extends VirusScanPort {
    async scan(storageKey: string, content: Buffer): Promise<void> {
        // Deliberately empty: acceptance is the verdict. The parameters are the contract a real
        // scanner consumes - naming them keeps this adapter's signature honest.
        void storageKey
        void content
    }
}
