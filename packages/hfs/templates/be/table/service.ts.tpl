import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { {{Name}}Row } from "./persistence/{{name}}.rows"
import { FIND_{{upper}} } from "./persistence/{{name}}.sql"

interface {{Name}}Request {
    readonly id: string
}

@Injectable()
/** The {{name}} rows reached only through the shared primary EntityManager. */
export class {{Name}}Service {
    constructor(@InjectPrimaryEntityManager() private readonly manager: EntityManager) {}

    /** Answers the requested row identity without exposing persistence types to the feature. */
    async {{nameCamel}}(request: {{Name}}Request): Promise<{ readonly id: string }> {
        const rows: Array<Pick<{{Name}}Row, "id">> = await this.manager.query(FIND_{{upper}}, [request.id])
        return { id: rows[0]?.id ?? request.id }
    }

    /** Accepts one {{singular}} delivery idempotently at the database boundary. */
    async accept{{Singular}}Delivery(delivery: {{Name}}Request): Promise<void> {
        await this.manager.query(FIND_{{upper}}, [delivery.id])
    }
}
