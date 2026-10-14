import type { DynamicModule, Type } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { DatabaseModule, parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** The modules that integration tests exercise without an application or HTTP listener. */
export interface ModulesWorldOptions {
    readonly modules: ReadonlyArray<Type<unknown> | DynamicModule>
}

/** Connects through the platform's declared primary connection to the already running local Supabase CLI stack. */
export const createTestDatabaseContext = async (options: ModulesWorldOptions): Promise<TestingModule> => {
    const connection = parsePrimaryDatabaseConfig(EnvSource.fromProcess())
    return Test.createTestingModule({ imports: [
        DatabaseModule.register({ connections: [connection], isGlobal: true }),
        ...options.modules,
    ] }).compile()
}
