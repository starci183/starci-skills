import {
    bootE2EModule 
} from "@e2e-kit/world/boot-e2e-module"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    TestingInfraModule 
} from "./testing-infra.module"
import {
    TestContext 
} from "./testing-infra.options"
import {
    E2EStackService 
} from "./platform/stack/e2e-stack.service"
import {
    E2EDbService 
} from "./platform/databases/e2e-db.service"
import {
    E2EHttpService 
} from "./integrations/http/e2e-http.service"
import {
    E2EGraphqlService 
} from "./integrations/graphql/e2e-graphql.service"
import {
    E2EAuthService 
} from "./bussiness/accounts/e2e-auth.service"

/**
 * The world every flow spec boots through (E2E-8): the run-scoped compose stack plus the two api
 * child processes, already past onModuleInit, with the spec-facing services resolved. A spec file
 * carries no wiring of its own - it calls bootE2eWorld once and reads what it needs.
 */
export interface E2EWorld {
  moduleRef: TestingModule;
  stack: E2EStackService;
  dataSource: E2EDbService;
  http: E2EHttpService;
  graphql: E2EGraphqlService;
  auth: E2EAuthService;
}

/**
 * Stands the run-owned stack up and hands back the resolved world. `specId` is hashed into the
 * compose project name so parallel specs never share a stack. compile() only instantiates - the
 * init() call here is what runs onModuleInit and brings postgres, redis and both apis up.
 */
export async function bootE2eWorld(specId?: string): Promise<E2EWorld> {
    const moduleRef = await bootE2EModule(Test,
        TestingInfraModule.register({
            context: TestContext.E2E, specId 
        }))
    return {
        moduleRef,
        stack: moduleRef.get(E2EStackService),
        dataSource: moduleRef.get(E2EDbService),
        http: moduleRef.get(E2EHttpService),
        graphql: moduleRef.get(E2EGraphqlService),
        auth: moduleRef.get(E2EAuthService),
    }
}
