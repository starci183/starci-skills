import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** The `SessionRow` shape the out-of-band read returns, column names as the table spells them. */
export interface SessionRow {
  token: string;
  person_id: string;
}

@Injectable()
/** Out-of-band reads and the one seeded write over the sessions table: verify and age, never a shortcut. */
export class E2ESessionsRepository {
    constructor(private readonly db: E2EDbService) {}

    async byToken(token: string): Promise<Array<SessionRow>> {
        return this.db.query<SessionRow>("SELECT token, person_id FROM sessions WHERE token = $1",
            [token])
    }

    async byTokens(tokens: Array<string>): Promise<Array<SessionRow>> {
        return this.db.query<SessionRow>("SELECT token, person_id FROM sessions WHERE token = ANY($1)",
            [tokens])
    }

    async countByToken(token: string): Promise<number> {
        const rows = await this.db.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM sessions WHERE token = $1",
            [token])
        return rows[0].count
    }

    /** Ages the session one second past its expiry; resolves to how many rows it touched. */
    async expireNow(token: string): Promise<number> {
        const rows = await this.db.query<{ token: string }>(
            "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token = $1 RETURNING token",
            [token],
        )
        return rows.length
    }
}
