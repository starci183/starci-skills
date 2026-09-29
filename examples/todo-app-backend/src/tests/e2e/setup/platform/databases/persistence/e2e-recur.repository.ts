import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

@Injectable()
/** Out-of-band reads over recurrence rules and their occurrences. */
export class E2ERecurRepository {
    constructor(private readonly db: E2EDbService) {}

    async endedAtOfRule(ruleId: string): Promise<Array<{ ended_at: string }>> {
        return this.db.query<{ ended_at: string }>("select ended_at from recurrence_rules where id = $1",
            [ruleId])
    }

    async occurrenceCountsByStatus(ruleId: string): Promise<Array<{ status: string; count: number }>> {
        return this.db.query<{ status: string; count: number }>(
            "select status, count(*)::int as count from occurrences where rule_id = $1 group by status order by status",
            [ruleId],
        )
    }

    async occurrenceCountAfter(ruleId: string, localDate: string): Promise<number> {
        const rows = await this.db.query<{ count: number }>(
            "select count(*)::int as count from occurrences where rule_id = $1 and local_date > $2",
            [ruleId,
                localDate],
        )
        return rows[0].count
    }
}
