import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** The `KeyRow` shape the out-of-band read returns, column names as the table spells them. */
export interface KeyRow {
  person_id: string;
  key_id: string;
}
/** The `ErasureRow` shape the out-of-band read returns, column names as the table spells them. */
export interface ErasureRow {
  request_id: string;
  person_id: string | null;
  state: string;
  verified_at: string | null;
  executing_at: string | null;
  completed_at: string | null;
}
/** The `StoredLine` shape the out-of-band read returns, column names as the table spells them. */
export interface StoredLine {
  action: string;
  target: string | null;
  key_id: string;
  actor: string;
}
/** The `ChainRow` shape the out-of-band read returns, column names as the table spells them. */
export interface ChainRow {
  id: string;
  prev_hash: string;
  hash: string;
}

@Injectable()
/** Out-of-band reads over the audit keys, log lines and erasure requests. */
export class E2EAuditRepository {
    constructor(private readonly db: E2EDbService) {}

    async keysOfPerson(personId: string): Promise<Array<KeyRow>> {
        return this.db.query<KeyRow>("SELECT person_id, key_id FROM audit_keys WHERE person_id = $1",
            [personId])
    }

    async keysOfPersonOrKey(personId: string, keyId: string): Promise<Array<KeyRow>> {
        return this.db.query<KeyRow>("SELECT person_id, key_id FROM audit_keys WHERE person_id = $1 OR key_id = $2",
            [personId,
                keyId])
    }

    async keyById(keyId: string): Promise<Array<KeyRow>> {
        return this.db.query<KeyRow>("SELECT person_id, key_id FROM audit_keys WHERE key_id = $1",
            [keyId])
    }

    async lineCountUnderKey(keyId: string): Promise<number> {
        const rows = await this.db.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM audit_log_lines WHERE key_id = $1",
            [keyId])
        return rows[0].count
    }

    async linesUnderKey(keyId: string): Promise<Array<StoredLine>> {
        return this.db.query<StoredLine>("SELECT action, target, key_id, actor FROM audit_log_lines WHERE key_id = $1 ORDER BY id",
            [keyId])
    }

    /** The system actor's erasure lines naming this request, in append order. */
    async erasureLinesOfRequest(requestId: string): Promise<Array<StoredLine>> {
        return this.db.query<StoredLine>(
            "SELECT action, target, key_id, actor FROM audit_log_lines WHERE action IN ('audit.erasure.requested', 'audit.erasure.completed') AND target = $1 ORDER BY id",
            [requestId],
        )
    }

    async chain(): Promise<Array<ChainRow>> {
        return this.db.query<ChainRow>("SELECT id, prev_hash, hash FROM audit_log_lines ORDER BY id")
    }

    async erasureRequest(requestId: string): Promise<Array<ErasureRow>> {
        return this.db.query<ErasureRow>(
            "SELECT request_id, person_id, state, verified_at::text, executing_at::text, completed_at::text FROM audit_erasure_requests WHERE request_id = $1",
            [requestId],
        )
    }
}
