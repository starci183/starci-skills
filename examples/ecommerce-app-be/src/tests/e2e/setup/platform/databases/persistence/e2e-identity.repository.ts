import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** A persisted person as the identity_person table holds it. */
export interface E2EPersonRow {
  id: string;
  email: string;
}

@Injectable()
/** Out-of-band reads and cleanup of the identity service's persisted people. */
export class E2EIdentityRepository {
    constructor(private readonly db: E2EDbService) {}

    personById(personId: string): Promise<Array<E2EPersonRow>> {
        return this.db.query<E2EPersonRow>("SELECT id, email FROM identity_person WHERE id = $1",
            [personId])
    }

    async deletePerson(personId: string): Promise<void> {
        await this.db.query("DELETE FROM identity_person WHERE id = $1",
            [personId])
    }
}
