import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./upload.module-definition"
import { UploadService } from "./upload.service"

@Module({})
/** The upload capability: the metadata rows, the intake rules and the presigned tokens. The bytes live in the storage integration; the handlers of the todo feature orchestrate both. */
export class UploadModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), UploadService], exports: [UploadService] }
    }
}
