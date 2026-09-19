import {
    DynamicModule, Global, Module 
} from "@nestjs/common"
import {
    E2EAccountsModule 
} from "./bussiness/accounts/accounts.module"
import {
    E2EGraphqlModule 
} from "./integrations/graphql/graphql.module"
import {
    E2EHttpModule 
} from "./integrations/http/http.module"
import {
    E2EDatabaseModule 
} from "./platform/databases/database.module"
import {
    E2EStackModule 
} from "./platform/stack/stack.module"
import {
    TESTING_INFRA_OPTIONS, TestingInfraOptions 
} from "./testing-infra.options"

export { TestContext, TestingInfraOptions, TESTING_INFRA_OPTIONS, E2E_BOOT_TIMEOUT_MS } from "./testing-infra.options"

/**
 * The register() options, published globally so every sub-module under this tree can inject
 * TESTING_INFRA_OPTIONS without each declaring its own register(). Global is safe here: a spec's
 * TestingModule contains exactly one TestingInfraModule registration.
 */
@Global()
@Module({
})
class TestingInfraContextModule {
    static register(options: TestingInfraOptions): DynamicModule {
        return {
            module: TestingInfraContextModule,
            providers: [{
                provide: TESTING_INFRA_OPTIONS, useValue: options 
            }],
            exports: [TESTING_INFRA_OPTIONS],
        }
    }
}

@Module({
})
/**
 * The one module every e2e spec boots: `TestingInfraModule.register({ context: TestContext.E2E })`.
 * Booting it brings up a spec-owned compose stack plus the api child process (E2EStackModule) and
 * exposes the doors specs use - http transport (E2EHttpModule), GraphQL transport
 * (E2EGraphqlModule), identity (E2EAccountsModule) and out-of-band db access (E2EDatabaseModule).
 * `moduleRef.close()` disposes the stack and asserts the containers and volumes are gone.
 */
export class TestingInfraModule {
    static register(options: TestingInfraOptions): DynamicModule {
        return {
            module: TestingInfraModule,
            imports: [
                TestingInfraContextModule.register(options),
                E2EStackModule,
                E2EDatabaseModule,
                E2EHttpModule,
                E2EGraphqlModule,
                E2EAccountsModule,
            ],
            exports: [
                E2EStackModule,
                E2EDatabaseModule,
                E2EHttpModule,
                E2EGraphqlModule,
                E2EAccountsModule,
            ],
        }
    }
}
