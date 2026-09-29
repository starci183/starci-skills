import {
    DataSource 
} from "typeorm"
import {
    entities, migrations 
} from "./persistence"

/**
 * Applies every pending migration of the primary connection and returns the names it ran. This is the one
 * place a process migrates: `apps/migrate` calls it once, before the api or a worker starts; the api never
 * runs migrations itself.
 */
export const runPrimaryMigrations = async (databaseUrl: string): Promise<ReadonlyArray<string>> => {
    const dataSource = new DataSource({
        type: "postgres",
        url: databaseUrl,
        entities,
        migrations: [...migrations],
        migrationsRun: false,
        synchronize: false,
    })
    await dataSource.initialize()
    try {
        const applied = await dataSource.runMigrations()
        return applied.map((migration) => migration.name)
    } finally {
        await dataSource.destroy()
    }
}
