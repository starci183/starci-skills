/**
 * The jest globalSetup of the test world (default export, Jest API): starts the shared infrastructure ONCE for the run and
 * hands its coordinates to the spec workers through a state file.
 *  1. the network-edge fakes of every third party (identity provider, mail host, payment gateway) and their control server;
 *  2. one Postgres container through `docker run`, named by the run, published on a loopback port the OS allocated;
 *  3. `apps/migrate` `bootstrap(options)` once against it: the only place that creates the schema;
 *  4. a run-owned upload directory.
 * A failure removes whatever was started before it is rethrown: jest does not call the teardown after a failed setup.
 */
import "tsconfig-paths/register"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { freePorts } from "@tests/world/kit/free-ports"
import { retryUntil } from "@tests/world/kit/readiness"
import { runToken, secret } from "@tests/world/kit/run-tokens"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { bootstrap } from "../../../apps/migrate/src/main"
import { primaryConnectionOf } from "../../../apps/migrate/src/migrate.options"
import { postgresAccepts, removeContainer, runPostgres } from "./docker.client"
import { FakesHost } from "./fakes/fakes-host.service"
import { writeWorldState } from "./test-world-state.service"

const DATABASE_USER = "e2e"
const DATABASE_NAME = "todo"
const DATABASE_READY_DEADLINE_MS = 120_000

/** Starts the shared infrastructure of the run and publishes its coordinates. */
export default async function globalSetup(): Promise<void> {
    const runId = runToken(4)
    const databaseContainer = `todo-e2e-pg-${runId}`
    const databasePassword = secret()
    const sepayApiKey = secret()
    const sepayWebhookSecret = secret()
    const uploadSigningSecret = secret()
    const uploadDir = mkdtempSync(join(tmpdir(), "todo-e2e-uploads-"))
    const fakes = new FakesHost({ apiKey: sepayApiKey, webhookSecret: sepayWebhookSecret })
    try {
        const endpoints = await fakes.start()
        const hostPort = (await freePorts(1))[0] ?? 0
        const databaseUrl = `postgres://${DATABASE_USER}:${databasePassword}@127.0.0.1:${hostPort}/${DATABASE_NAME}`
        runPostgres({
            name: databaseContainer,
            runId,
            hostPort,
            user: DATABASE_USER,
            password: databasePassword,
            database: DATABASE_NAME,
        })
        await retryUntil("postgres accepts connections", DATABASE_READY_DEADLINE_MS, () =>
            Promise.resolve(postgresAccepts(databaseContainer, DATABASE_USER, DATABASE_NAME)),
        )
        await bootstrap({
            connections: [
                primaryConnectionOf(parsePrimaryDatabaseConfig(new EnvSource({ PRIMARY_DB_URL: databaseUrl }))),
            ],
        })
        writeWorldState({
            runId,
            databaseContainer,
            databaseUser: DATABASE_USER,
            databaseName: DATABASE_NAME,
            databaseUrl,
            controlUrl: endpoints.controlUrl,
            keycloakTokenUrl: endpoints.keycloakTokenUrl,
            keycloakClientId: endpoints.keycloakClientId,
            smtpPort: endpoints.smtpPort,
            sepayBaseUrl: endpoints.sepayBaseUrl,
            sepayApiKey,
            sepayWebhookSecret,
            uploadDir,
            uploadSigningSecret,
        })
    } catch (error) {
        await fakes.close()
        removeContainer(databaseContainer)
        rmSync(uploadDir, { recursive: true, force: true })
        throw error
    }
}
