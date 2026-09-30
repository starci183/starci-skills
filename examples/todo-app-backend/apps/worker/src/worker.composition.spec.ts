import "reflect-metadata"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { getDataSourceToken } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { mock } from "@starci/jest-preset/mock"
import { TaskService } from "@modules/domain/task"
import { Secret } from "@modules/platform/config"
import { DATABASE_PROBE, PRIMARY_CONNECTION } from "@modules/platform/database"
import type { Probe } from "@modules/platform/probes"
import { mockEntityManager } from "@tests/fixtures/database"
import { AppModule } from "./app.module"
import type { WorkerAppOptions } from "./worker.options"

const options: WorkerAppOptions = {
    database: { name: PRIMARY_CONNECTION, url: new Secret("postgres://localhost:0/todo") },
    scheduling: { tickMs: 1000 },
    messaging: { pollMs: 1000, batchSize: 10, visibilityMs: 60_000 },
    identity: { ttlDays: 1, adminSubjects: [] },
    keycloak: { tokenUrl: "http://localhost:0/token", clientId: "todo-api", timeoutMs: 100 },
    sepay: { baseUrl: "http://localhost:0", apiKey: new Secret("k"), webhookSecret: new Secret("w"), timeoutMs: 100 },
    plan: { paidPriceMinorUnits: 99000, paidCurrency: "VND" },
    recur: { tickCron: "*/5 * * * *" },
    upload: { maxBytes: 1024, allowedMimes: ["text/plain"], presignTtlMs: 1000, signingSecret: new Secret("s") },
    uploadStorage: { directory: "/tmp/todo-uploads" },
    notifySmtp: { host: "localhost", port: 0, from: "todo@example.test", connectTimeoutMs: 100, commandTimeoutMs: 100 },
}

describe("worker AppModule", () => {
    let module: TestingModule
    const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })

    beforeAll(async () => {
        const dataSource = mock<DataSource>({ isInitialized: false, manager, entityMetadatas: [], options: { type: "postgres" } })
        module = await Test.createTestingModule({ imports: [AppModule.register(options)] })
            .overrideProvider(getDataSourceToken(PRIMARY_CONNECTION))
            .useValue(dataSource)
            .compile()
    })

    afterAll(async () => {
        await module.close()
    })

    it("compiles the real root module with the database doubled and resolves a capability service", () => {
        expect(module.get(TaskService)).toBeInstanceOf(TaskService)
    })

    it("binds the one primary EntityManager to the connection double", async () => {
        await module.get<Probe>(DATABASE_PROBE).check()
        expect(manager.query).toHaveBeenCalledTimes(1)
    })
})
