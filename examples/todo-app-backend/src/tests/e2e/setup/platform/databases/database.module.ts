import {
    Module 
} from "@nestjs/common"
import {
    E2EStackModule 
} from "../stack/stack.module"
import {
    E2EDbService 
} from "./e2e-db.service"
import {
    E2EAuditRepository 
} from "./persistence/e2e-audit.repository"
import {
    E2ENotifyRepository 
} from "./persistence/e2e-notify.repository"
import {
    E2EPlanRepository 
} from "./persistence/e2e-plan.repository"
import {
    E2ERecurRepository 
} from "./persistence/e2e-recur.repository"
import {
    E2ESchemaRepository 
} from "./persistence/e2e-schema.repository"
import {
    E2ESessionsRepository 
} from "./persistence/e2e-sessions.repository"
import {
    E2EShareRepository 
} from "./persistence/e2e-share.repository"
import {
    E2ETasksRepository 
} from "./persistence/e2e-tasks.repository"
import {
    E2EUploadsRepository 
} from "./persistence/e2e-uploads.repository"

const REPOSITORIES = [E2EAuditRepository,
    E2ENotifyRepository,
    E2EPlanRepository,
    E2ERecurRepository,
    E2ESchemaRepository,
    E2ESessionsRepository,
    E2EShareRepository,
    E2ETasksRepository,
    E2EUploadsRepository]

@Module({
    imports: [E2EStackModule],
    providers: [E2EDbService,
        ...REPOSITORIES],
    exports: [E2EDbService,
        ...REPOSITORIES],
})
/**
 * The platform layer's database capability: out-of-band DataSource access to the run-owned postgres
 * for seed/verify only. Depends on the stack module for the run-scoped DATABASE_URL.
 */
export class E2EDatabaseModule {}
