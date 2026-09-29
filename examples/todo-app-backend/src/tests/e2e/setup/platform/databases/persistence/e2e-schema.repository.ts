import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

@Injectable()
/** Schema-level reads: which tables the migrations built, how full one is, and whether postgres answers. */
export class E2ESchemaRepository {
    constructor(private readonly db: E2EDbService) {}

    /** Distinct table names in the public schema - what the api's own migrations created. */
    async tableNames(): Promise<Array<string>> {
        const rows = await this.db.query<{ table_name: string }>(
            "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
        )
        return rows.map((row) => row.table_name)
    }

    async countRows(table: string): Promise<number> {
        if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error(`unsafe table name ${table}`)
        const rows = await this.db.query<{ count: string }>(`select count(*) as count from "${table}"`)
        return Number(rows[0]?.count ?? 0)
    }

    /** True when postgres answers a real query. */
    async ping(): Promise<boolean> {
        const rows = await this.db.query<{ ok: number }>("select 1 as ok")
        return rows[0].ok === 1
    }
}
