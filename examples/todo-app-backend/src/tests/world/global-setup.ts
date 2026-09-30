/**
 * The jest globalSetup of the test world (default export, Jest API): starts the shared infrastructure ONCE for the run and
 * hands its coordinates to the spec workers through a state file.
 *  1. the stack of the repository (`.starcistacks/dev`) through `hfs test-stack up`: every service it declares runs for real
 *     behind toxiproxy; a warm stack (`npm run test:stack -- up`) that already answers is attached to, else this run starts
 *     its own and stops it again;
 *  2. the network-edge fakes of the external SaaS the team does not operate (payment gateway) and the mail host, which the
 *     stack does not declare, plus their control server;
 *  3. one database per run inside the stack's Postgres, and `apps/migrate` `bootstrap(options)` once against it: the only
 *     place that creates the schema;
 *  4. a run-owned upload directory.
 * A failure removes whatever this run started before it is rethrown: jest does not call the teardown after a failed setup.
 */
import "tsconfig-paths/register"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runToken, secret } from "@tests/world/kit/run-tokens"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { bootstrap } from "../../../apps/migrate/src/main"
import { primaryConnectionOf } from "../../../apps/migrate/src/migrate.options"
import { createDatabase, databaseUrlOf, dropDatabase } from "./database.client"
import { FakesHost } from "./fakes/fakes-host.service"
import { importedRealmOf } from "./identity-provider.client"
import { serviceOf, startStack, stopStack } from "./stack.client"
import { writeWorldState } from "./test-world-state.service"

/** Starts the shared infrastructure of the run and publishes its coordinates. */
export default async function globalSetup(): Promise<void> {
    const runId = runToken(4)
    const databaseName = `todo_e2e_${runId}`
    const sepayApiKey = secret()
    const sepayWebhookSecret = secret()
    const uploadSigningSecret = secret()
    const uploadDir = mkdtempSync(join(tmpdir(), "todo-e2e-uploads-"))
    const fakes = new FakesHost({ apiKey: sepayApiKey, webhookSecret: sepayWebhookSecret })
    const stack = startStack()
    try {
        const endpoints = await fakes.start()
        await createDatabase(stack, databaseName)
        const databaseDirectUrl = databaseUrlOf(stack, databaseName, false)
        await bootstrap({ connections: [primaryConnectionOf(parsePrimaryDatabaseConfig(new EnvSource({ PRIMARY_DB_URL: databaseDirectUrl })))] })
        const { realm, clientId } = importedRealmOf(serviceOf(stack, "keycloak"))
        writeWorldState({
            runId,
            ownsStack: stack.started,
            stack,
            databaseName,
            databaseUrl: databaseUrlOf(stack, databaseName, true),
            databaseDirectUrl,
            keycloakRealm: realm,
            keycloakClientId: clientId,
            controlUrl: endpoints.controlUrl,
            smtpPort: endpoints.smtpPort,
            sepayBaseUrl: endpoints.sepayBaseUrl,
            sepayApiKey,
            sepayWebhookSecret,
            uploadDir,
            uploadSigningSecret,
        })
    } catch (error) {
        await fakes.close()
        rmSync(uploadDir, { recursive: true, force: true })
        if (stack.started) stopStack()
        else await dropDatabase(stack, databaseName)
        throw error
    }
}
