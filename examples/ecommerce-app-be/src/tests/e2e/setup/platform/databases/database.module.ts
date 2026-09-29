import {
    Module
} from "@nestjs/common"
import {
    StackModule
} from "../stack/stack.module"
import {
    E2EDbService
} from "./e2e-db.service"
import {
    E2ECatalogRepository
} from "./persistence/e2e-catalog.repository"
import {
    E2EIdentityRepository
} from "./persistence/e2e-identity.repository"
import {
    E2EOrdersRepository
} from "./persistence/e2e-orders.repository"
import {
    E2EPaymentsRepository
} from "./persistence/e2e-payments.repository"
import {
    E2ESchemaRepository
} from "./persistence/e2e-schema.repository"

@Module({
    imports: [StackModule],
    providers: [
        E2EDbService,
        E2ECatalogRepository,
        E2EIdentityRepository,
        E2EOrdersRepository,
        E2EPaymentsRepository,
        E2ESchemaRepository,
    ],
    exports: [
        E2EDbService,
        E2ECatalogRepository,
        E2EIdentityRepository,
        E2EOrdersRepository,
        E2EPaymentsRepository,
        E2ESchemaRepository,
    ],
})
/** The test-infra database platform module: E2EDbService plus the repositories that hold the out-of-band SQL. */
export class DatabaseModule {}
