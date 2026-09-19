import {
    Module 
} from "@nestjs/common"
import {
    E2EGraphqlModule 
} from "../../integrations/graphql/graphql.module"
import {
    DatabaseModule 
} from "../../platform/databases/database.module"
import {
    E2EAuthService 
} from "./e2e-auth.service"

@Module({
    imports: [E2EGraphqlModule,
        DatabaseModule],
    providers: [E2EAuthService],
    exports: [E2EAuthService],
})
/** The test-infra accounts capability: the spec-facing E2EAuthService account lifecycle. */
export class AccountsModule {}
