import {
    DataSource 
} from "typeorm"
import {
    entities, migrations 
} from "./persistence"

/**
 * Applies every pending migration of the order connection and returns the names it ran. This is the one
 * place a process migrates: `apps/migrate` calls it once, before an api starts; an api never runs
 * migrations itself. The ledger table is this connection's own, so the two services sharing one Postgres
 * database keep independent histories.
 */
export const runOrderMigrations = async (databaseUrl: string): Promise<ReadonlyArray<string>> => {
    const dataSource = new DataSource({
        type: "postgres",
        url: databaseUrl,
        entities,
        migrations: [...migrations],
        migrationsTableName: "order_migrations",
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
