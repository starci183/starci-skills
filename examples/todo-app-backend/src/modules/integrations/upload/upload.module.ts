import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { UploadClient } from "./upload.client"
import { UPLOAD_SCAN, UPLOAD_STORAGE } from "./upload.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./upload.module-definition"
import { UploadScanClient } from "./upload-scan.client"

@Module({})
/** Provides the byte plane of the uploads: the local filesystem storage and the content inspection hook. */
export class UploadStorageModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that stores upload bytes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: UPLOAD_STORAGE, useClass: UploadClient },
                { provide: UPLOAD_SCAN, useClass: UploadScanClient },
            ],
            exports: [UPLOAD_STORAGE, UPLOAD_SCAN],
        }
    }
}
