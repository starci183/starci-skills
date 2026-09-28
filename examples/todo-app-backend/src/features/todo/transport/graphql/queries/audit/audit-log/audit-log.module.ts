import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./audit-log.module-definition"
import {
    AuditLogResolver 
} from "./audit-log.resolver"

@Module({
    imports: [CqrsModule],
    providers: [AuditLogResolver],
})
/** auditLog's module: mounts AuditLogResolver; the query handler is discovered app-wide through CqrsModule. */
export class AuditLogSingleQueryModule extends ConfigurableModuleClass {}
