import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AuditErasureService } from "./audit-erasure.service"
import { AuditKeystoreService } from "./audit-keystore.service"
import { AuditLogService } from "./audit-log.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./audit.module-definition"

@Module({})
/** The audit capability: the sealed hash-chained log, the keystore and the erasure lifecycle. The handlers and the queue consumer live in the todo feature. */
export class AuditModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AuditKeystoreService, AuditLogService, AuditErasureService],
            exports: [AuditKeystoreService, AuditLogService, AuditErasureService],
        }
    }
}
