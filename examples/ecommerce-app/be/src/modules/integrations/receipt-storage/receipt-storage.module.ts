import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { RECEIPT_STORAGE } from "./receipt-storage.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./receipt-storage.module-definition"
import { S3ReceiptStorageClient } from "./s3-receipt-storage.client"

@Module({})
/** Provides the receipt archive: the private S3 bucket (MinIO in the stack). */
export class ReceiptStorageModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that archives receipts. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: RECEIPT_STORAGE, useClass: S3ReceiptStorageClient }],
            exports: [RECEIPT_STORAGE],
        }
    }
}
