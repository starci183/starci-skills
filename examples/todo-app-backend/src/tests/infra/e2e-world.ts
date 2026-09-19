import {
    bootE2EModule 
} from "@e2e-kit/world/boot-e2e-module"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    DataSource 
} from "typeorm"
import {
    E2EAuthService 
} from "./bussiness/accounts/e2e-auth.service"
import {
    E2EHttpService 
} from "./integrations/http/e2e-http.service"
import {
    E2EDbService 
} from "./platform/databases/e2e-db.service"
import {
    E2EStackService 
} from "./platform/stack/e2e-stack.service"
import {
    TestingInfraModule 
} from "./testing-infra.module"
import {
    TestContext 
} from "./testing-infra.options"

/**
 * The running world a journey spec drives: the testing module ref (whose close() is the spec's only
 * teardown - it disposes the compose stack and verifies nothing is left) plus the resolved door
 * services every journey uses.
 */
export interface E2EWorld {
  readonly moduleRef: TestingModule;
  readonly stack: E2EStackService;
  readonly http: E2EHttpService;
  readonly auth: E2EAuthService;
  readonly db: E2EDbService;
  readonly dataSource: DataSource;
}

/**
 * The one place an e2e flow stands the world up: registers TestingInfraModule for the e2e context,
 * waits out module init - which includes the compose stack boot and the api child process - then
 * resolves the door services and the live DataSource every persisted-state assertion reads through.
 * Specs call this instead of Test.createTestingModule so the wiring exists exactly once; a flow
 * that needs a provider override states it on the returned moduleRef rather than rebuilding a graph.
 */
export async function bootE2EWorld(specId?: string): Promise<E2EWorld> {
    const moduleRef = await bootE2EModule(Test,
        TestingInfraModule.register({
            context: TestContext.E2E, specId 
        }))
    const db = moduleRef.get(E2EDbService)
    return {
        moduleRef,
        stack: moduleRef.get(E2EStackService),
        http: moduleRef.get(E2EHttpService),
        auth: moduleRef.get(E2EAuthService),
        db,
        dataSource: await db.getDataSource(),
    }
}
