import {
    Injectable, OnApplicationShutdown, OnModuleInit 
} from "@nestjs/common"
import {
    DataSource 
} from "typeorm"
import {
    E2EStackService 
} from "../stack/e2e-stack.service"

@Injectable()
/**
 * Out-of-band access to the run-owned postgres: seed and verify only, never a shortcut for the flow
 * under test. The DataSource points at this spec's compose postgres through the stack service's
 * DATABASE_URL; it is initialized lazily and on module init, and destroyed on shutdown.
 */
export class E2EDbService implements OnModuleInit, OnApplicationShutdown {
    private dataSource: DataSource | null = null
    private initializing: Promise<DataSource> | null = null

    constructor(private readonly stack: E2EStackService) {}

    async onModuleInit(): Promise<void> {
        await this.source()
    }

    async onApplicationShutdown(): Promise<void> {
        if (this.dataSource?.isInitialized) {
            await this.dataSource.destroy()
        }
        this.dataSource = null
        this.initializing = null
    }

    /**
     * The live run-owned DataSource itself, for specs that assert persisted state through TypeORM's
     * own read path - the same connection the api's postgres is on, handed out rather than wrapped,
     * so the spec's read is provably the database's answer and not this service's interpretation.
     */
    async getDataSource(): Promise<DataSource> {
        return this.source()
    }

    async query<T = Record<string, unknown>>(sql: string, params?: Array<unknown>): Promise<Array<T>> {
        const raw: unknown = await (await this.source()).query(sql,
            params)
        // TypeORM hands back a [rows, affected] tuple for DML statements with RETURNING; the contract
        // here is always the row list.
        const rows = Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === "number"
            ? raw[0]
            : raw
        return rows as Array<T>
    }

    /** Distinct table names in the public schema - what the api's own migrations created. */
    async tableNames(): Promise<Array<string>> {
        const rows = await this.query<{ table_name: string }>(
            "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
        )
        return rows.map((row) => row.table_name)
    }

    async countRows(table: string): Promise<number> {
        if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error(`unsafe table name ${table}`)
        const rows = await this.query<{ count: string }>(`select count(*) as count from "${table}"`)
        return Number(rows[0]?.count ?? 0)
    }

    private async source(): Promise<DataSource> {
    // Provider onModuleInit hooks run concurrently, so the stack may still be booting; whenReady
    // gates this on the compose services actually being up.
        await this.stack.whenReady()
        if (this.dataSource?.isInitialized) return this.dataSource
        if (!this.initializing) {
            const dataSource = new DataSource({
                type: "postgres", url: this.stack.databaseUrl 
            })
            this.initializing = dataSource.initialize().then((initialized) => {
                this.dataSource = initialized
                return initialized
            })
        }
        return this.initializing
    }
}
