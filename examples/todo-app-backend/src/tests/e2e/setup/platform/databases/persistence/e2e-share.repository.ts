import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** The `InvitationRow` shape the out-of-band read returns, column names as the table spells them. */
export interface InvitationRow {
  status: string;
  person_id: string | null;
  revoked_at: string | null;
}

@Injectable()
/** Out-of-band reads over invitations. */
export class E2EShareRepository {
    constructor(private readonly db: E2EDbService) {}

    async invitationById(id: string): Promise<Array<InvitationRow>> {
        return this.db.query<InvitationRow>("select status, person_id, revoked_at from invitations where id = $1",
            [id])
    }
}
