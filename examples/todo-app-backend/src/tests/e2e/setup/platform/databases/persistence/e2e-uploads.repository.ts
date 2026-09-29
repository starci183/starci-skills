import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** The `UploadRow` shape the out-of-band read returns, column names as the table spells them. */
export interface UploadRow {
  id: string;
  owner: string;
  task_id: string | null;
  filename: string;
  mime: string;
  size_bytes: number;
  storage_key: string;
  status: string;
}

@Injectable()
/** Out-of-band reads over the uploads table. */
export class E2EUploadsRepository {
    constructor(private readonly db: E2EDbService) {}

    async byId(id: string): Promise<Array<UploadRow>> {
        return this.db.query<UploadRow>(
            "SELECT id, owner, task_id, filename, mime, size_bytes, storage_key, status FROM uploads WHERE id = $1",
            [id],
        )
    }

    async countById(id: string): Promise<number> {
        const rows = await this.db.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM uploads WHERE id = $1",
            [id])
        return rows[0].count
    }
}
