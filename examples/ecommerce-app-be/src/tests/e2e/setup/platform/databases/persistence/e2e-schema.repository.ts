import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** A `count(*)::int` answer. */
interface CountRow {
  count: number;
}

@Injectable()
/** Out-of-band reads of the database itself: liveness and the migrated schema. */
export class E2ESchemaRepository {
    constructor(private readonly db: E2EDbService) {}

    async ping(): Promise<boolean> {
        const rows = await this.db.query<{ alive: number }>("SELECT 1 AS alive")
        return rows[0].alive === 1
    }

    async publicTableCount(): Promise<number> {
        const rows = await this.db.query<CountRow>(
            "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'")
        return rows[0].count
    }
}
