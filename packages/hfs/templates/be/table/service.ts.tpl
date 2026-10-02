import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { acceptRowDelivery, findRowIdentity, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { {{Name}}Row } from "./persistence/{{name}}.rows"
import { FIND_{{upper}} } from "./persistence/{{name}}.sql"

interface {{Name}}Request {
    readonly id: string
}

interface {{Name}}Result {
    readonly id: string
}

@Injectable()
/** The {{name}} rows reached only through the shared primary EntityManager. */
export class {{Name}}Service {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers the requested row identity without exposing persistence types to the feature. */
    {{nameCamel}}(request: {{Name}}Request): Promise<{{Name}}Result> {
        return findRowIdentity<{{Name}}Row>(this.entityManager, FIND_{{upper}}, request.id)
    }

    /** Accepts one {{singular}} delivery idempotently at the database boundary. */
    async accept{{Singular}}Delivery(delivery: {{Name}}Request): Promise<void> {
        await acceptRowDelivery(this.entityManager, FIND_{{upper}}, delivery.id)
    }
}
