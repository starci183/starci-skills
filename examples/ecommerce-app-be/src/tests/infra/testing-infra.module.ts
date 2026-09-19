import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    AccountsModule 
} from "./bussiness/accounts/accounts.module"
import {
    HttpModule 
} from "./integrations/http/http.module"
import {
    E2EGraphqlModule 
} from "./integrations/graphql/graphql.module"
import {
    DatabaseModule 
} from "./platform/databases/database.module"
import {
    StackModule 
} from "./platform/stack/stack.module"
import {
    TESTING_INFRA_OPTIONS, TestingInfraOptions 
} from "./testing-infra.options"

export { TestContext, TESTING_INFRA_OPTIONS } from "./testing-infra.options"
export type { TestingInfraOptions } from "./testing-infra.options"

/**
 * Global carrier for the register() options: TESTING_INFRA_OPTIONS resolves inside every infra
 * sub-module (the stack service injects it for the specId) without each module re-declaring it.
 */
@Module({
})
class TestingInfraOptionsModule {}

@Module({
})
/**
 * The e2e infrastructure facade. A spec boots it with
 * `imports: [TestingInfraModule.register({ context: TestContext.E2E, specId: '<area>/<flow>' })]`;
 * compile() runs E2EStackService.onModuleInit (compose up + api spawn, identity before order) and
 * moduleRef.close() runs the teardown, which disposes the run-scoped project and records a cleanup
 * report the spec can assert on. The specId is hashed into the compose project name so specs run
 * in parallel later never share containers.
 *
 * The infra itself is a module tree mirroring src/modules layering: platform (stack, databases),
 * integrations (http for the justified machine/probe doors, graphql for the public API) and
 * bussiness (accounts), each a real Nest module with providers/exports - this facade only wires
 * them together behind the register() door.
 */
export class TestingInfraModule {
    static register(options: TestingInfraOptions): DynamicModule {
        return {
            module: TestingInfraModule,
            imports: [
                {
                    module: TestingInfraOptionsModule,
                    global: true,
                    providers: [{
                        provide: TESTING_INFRA_OPTIONS, useValue: options 
                    }],
                    exports: [TESTING_INFRA_OPTIONS],
                },
                StackModule,
                DatabaseModule,
                HttpModule,
                E2EGraphqlModule,
                AccountsModule,
            ],
            exports: [TestingInfraOptionsModule,
                StackModule,
                DatabaseModule,
                HttpModule,
                E2EGraphqlModule,
                AccountsModule],
        }
    }
}
