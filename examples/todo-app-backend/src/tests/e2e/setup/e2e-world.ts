import {
    bootE2EModule 
} from "@e2e-kit/world/boot-e2e-module"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    E2EAuthService 
} from "./domain/accounts/e2e-auth.service"
import {
    E2EHttpService 
} from "./integrations/http/e2e-http.service"
import {
    E2EAuditRepository 
} from "./platform/databases/persistence/e2e-audit.repository"
import {
    E2ENotifyRepository 
} from "./platform/databases/persistence/e2e-notify.repository"
import {
    E2EPlanRepository 
} from "./platform/databases/persistence/e2e-plan.repository"
import {
    E2ERecurRepository 
} from "./platform/databases/persistence/e2e-recur.repository"
import {
    E2ESchemaRepository 
} from "./platform/databases/persistence/e2e-schema.repository"
import {
    E2ESessionsRepository 
} from "./platform/databases/persistence/e2e-sessions.repository"
import {
    E2EShareRepository 
} from "./platform/databases/persistence/e2e-share.repository"
import {
    E2ETasksRepository 
} from "./platform/databases/persistence/e2e-tasks.repository"
import {
    E2EUploadsRepository 
} from "./platform/databases/persistence/e2e-uploads.repository"
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

/** The out-of-band, read-mostly views of the run-owned postgres, one repository per capability. */
export interface E2EData {
  readonly audit: E2EAuditRepository;
  readonly notify: E2ENotifyRepository;
  readonly plan: E2EPlanRepository;
  readonly recur: E2ERecurRepository;
  readonly schema: E2ESchemaRepository;
  readonly sessions: E2ESessionsRepository;
  readonly share: E2EShareRepository;
  readonly tasks: E2ETasksRepository;
  readonly uploads: E2EUploadsRepository;
}

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
  readonly data: E2EData;
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
        data: {
            audit: moduleRef.get(E2EAuditRepository),
            notify: moduleRef.get(E2ENotifyRepository),
            plan: moduleRef.get(E2EPlanRepository),
            recur: moduleRef.get(E2ERecurRepository),
            schema: moduleRef.get(E2ESchemaRepository),
            sessions: moduleRef.get(E2ESessionsRepository),
            share: moduleRef.get(E2EShareRepository),
            tasks: moduleRef.get(E2ETasksRepository),
            uploads: moduleRef.get(E2EUploadsRepository),
        },
    }
}
