/**
 * The typed options the test world hands to the real apps, the migrate step and the platform base of a modules world: what the
 * `main.ts` of each app parses from the environment of a deployment, built from the wiring of the run. The databases are the real
 * ones the library runs; the migrate step is the cli app's own migration runner, the one `cli migrate run` calls.
 */
import type { DynamicModule } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import type { WorldWiring } from "@starci/test-world"
import { ClockModule } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { DatabaseModule, MigrationRunnerService } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import { LoggingModule } from "@modules/platform/logging"
import { RetryModule } from "@modules/platform/retry"
import { AppModule as CliApp } from "../../../apps/cli/src/app.module"
import { readCliEnv } from "../../../apps/cli/src/cli.env"
import { createCliAppOptions } from "../../../apps/cli/src/cli.options"
import type { CliAppOptions } from "../../../apps/cli/src/cli.options"
{{appEnvImports}}

/** The wiring of the world: its api apps and its database connections. */
export type AppWiring = WorldWiring<{{appsUnion}}, {{connectionsUnion}}>

/** The one browser origin the apps of the world accept. */
export const ALLOWED_ORIGIN = "http://localhost:3000"

/** The environment a deployment hands every app of the run: its mode, its origin allowlist and the URL of every connection. */
const environmentOf = (w: AppWiring, extra: Readonly<Record<string, string>> = {}): EnvSource =>
    new EnvSource({
        NODE_ENV: "test",
        HTTP_SECURITY_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
{{environmentConnections}}
        ...extra,
    })
{{appOptions}}
/** The origin allowlist and rate limits of the run, read the way the api apps read them. */
export const httpSecurityOf = (w: AppWiring): HttpSecurityOptions => parseHttpSecurityConfig(environmentOf(w))

/** The cli app over the run's databases, read the way its `main.ts` reads its environment. */
export const cliOptionsOf = (w: AppWiring): CliAppOptions => createCliAppOptions(readCliEnv(environmentOf(w)))

/** The migrate step of the run: the cli app composed over the run's databases, running the migrations of every connection. */
export const migrateCli = async (options: CliAppOptions): Promise<void> => {
    const cli = await NestFactory.createApplicationContext(CliApp.register(options), { logger: false })
    try {
        await cli.get(MigrationRunnerService).run()
    } finally {
        await cli.close()
    }
}

/** The platform base of a modules world: the clock, the timer, the logger and the database over the run's connections. */
export const platformBase = (w: AppWiring): ReadonlyArray<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    RetryModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    DatabaseModule.register({
        isGlobal: true,
        connections: [{ ...cliOptionsOf(w).database, entities: [], migrations: [] }],
    }),
]
