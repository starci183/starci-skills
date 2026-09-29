import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** The `TaskRow` shape the out-of-band read returns, column names as the table spells them. */
export interface TaskRow {
  id: string;
  owner: string;
  title: string;
  complete: boolean;
  completed_at: Date | null;
}

/** The `TaskStateRow` shape the out-of-band read returns, column names as the table spells them. */
export type TaskStateRow = Pick<TaskRow, "owner" | "complete" | "completed_at">

@Injectable()
/** Out-of-band reads over the tasks table. */
export class E2ETasksRepository {
    constructor(private readonly db: E2EDbService) {}

    async byId(id: string): Promise<Array<TaskRow>> {
        return this.db.query<TaskRow>("SELECT id, owner, title, complete, completed_at FROM tasks WHERE id = $1",
            [id])
    }

    async stateById(id: string): Promise<Array<TaskStateRow>> {
        return this.db.query<TaskStateRow>("SELECT owner, complete, completed_at FROM tasks WHERE id = $1",
            [id])
    }
}
