/**
 * The declaration of the todo test world: selection and overrides only. The service list and the image versions come from
 * the stack definition (`.starcistacks/dev`); the library runs Postgres, Keycloak (with the stack's realm), MinIO (the
 * uploads bucket) and Redis real behind toxiproxy, the mail host and the payment gateway as fakes at the network edge, and
 * boots the real apps in process.
 */
import { defineTestWorld } from "@starci/test-world"
import { sepayFake, smtpFake } from "@starci/test-world/fakes"
import { HttpModule } from "@modules/platform/http"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { AppModule as TodoApp } from "../../../apps/todo/src/app.module"
import { AppModule as WorkerApp } from "../../../apps/worker/src/app.module"
import * as migrateMain from "../../../apps/migrate/src/main"
import { primaryConnectionOf } from "../../../apps/migrate/src/migrate.options"
import type { SignInData } from "@tests/fixtures/views/e2e-views.contracts"
import { UPLOADS_BUCKET, testOptions } from "./test-apps.options"
import { platformBase } from "./test-capabilities.options"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { TODO_KEYCLOAK_CLIENT } from "./todo-identity.contracts"
import { TODO_OPERATIONS } from "./todo-operations.contracts"

export const { useTestWorld, useSandbox } = defineTestWorld({
    stack: ".starcistacks/dev",
    stacks: {
        postgresql: { connections: [{ name: "primary" }] },
        keycloak: { realm: ".starcistacks/dev/infra/compose/realm-todo.json", clientId: TODO_KEYCLOAK_CLIENT },
        minio: { buckets: [UPLOADS_BUCKET] },
        redis: {},
    },
    fakes: { smtp: smtpFake(), sepay: sepayFake({ webhookPath: "/webhooks/sepay", webhookStyle: "intent" }) },
    apps: {
        todo: {
            module: TodoApp,
            operations: TODO_OPERATIONS,
            options: testOptions,
            configure: (app, options) => {
                app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
            },
        },
        worker: { module: WorkerApp, listen: false, options: testOptions },
    },
    migrate: {
        module: migrateMain,
        options: (w) => ({
            connections: [
                primaryConnectionOf(parsePrimaryDatabaseConfig(new EnvSource({ PRIMARY_DB_URL: w.db.primary.url }))),
            ],
        }),
    },
    identity: {
        register: "keycloak",
        signIn: async (world, { email, password }) => {
            const todo = world.apps.todo
            if (todo === undefined) {
                throw new TestWorldError({
                    code: TestWorldErrorCode.NotDeclared,
                    params: { detail: "signing in needs the todo app booted" },
                })
            }
            const observed = await todo.api.graphql<SignInData>("signIn", { input: { email, password } })
            if (observed.data === null) {
                throw new TestWorldError({
                    code: TestWorldErrorCode.SignInRefused,
                    params: { detail: `${email}: ${observed.errorCode ?? "no data"}` },
                })
            }
            return observed.data.signIn
        },
    },
    modules: { base: platformBase },
    sandbox: { base: () => [HttpModule.register({ isGlobal: true })] },
})
