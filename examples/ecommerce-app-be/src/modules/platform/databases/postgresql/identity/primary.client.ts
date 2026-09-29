import {
    Injectable 
} from "@nestjs/common"
import {
    InjectDataSource 
} from "@nestjs/typeorm"
import {
    DataSource 
} from "typeorm"
import {
    CONNECTION, pingDatabase 
} from "./persistence"

@Injectable()
/** The health-probe handle over the named DataSource - `ping` proves the connection answers. */
export class PostgresPrimaryClient {
    constructor(@InjectDataSource(CONNECTION) private readonly dataSource: DataSource) {}

    /** Resolves when the database answers, rejects with the driver's failure when it does not. */
    async ping(): Promise<void> {
        await pingDatabase(this.dataSource)
    }
}
