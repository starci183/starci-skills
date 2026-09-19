import {
    Injectable, OnModuleDestroy 
} from "@nestjs/common"
import {
    DataSource 
} from "typeorm"
import {
    E2EStackService 
} from "../stack/e2e-stack.service"

@Injectable()
/**
 * Out-of-band Postgres access for seed/verify: a bare DataSource (no entities, no migrations, no
 * synchronize) opened lazily against this run's compose Postgres. The door for asserting that a
 * flow really persisted - it must never be used to shortcut the flow under test itself.
 */
export class E2EDbService implements OnModuleDestroy {
    private dataSource: DataSource | null = null

    constructor(private readonly stack: E2EStackService) {}

    async query<T = Record<string, unknown>>(sql: string, parameters?: Array<unknown>): Promise<Array<T>> {
        if (!this.dataSource) {
            this.dataSource = new DataSource({
                type: "postgres", url: this.stack.databaseUrl 
            })
            await this.dataSource.initialize()
        }
        return this.dataSource.query(sql,
            parameters) as Promise<Array<T>>
    }

    async onModuleDestroy(): Promise<void> {
        if (this.dataSource?.isInitialized) await this.dataSource.destroy()
        this.dataSource = null
    }
}
