import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, requireOwnedRow } from "@modules/platform/database"
import { {{Name}}Error, {{Name}}ErrorCode } from "./errors/{{name}}.error"
import type { {{Name}}Row } from "./persistence/{{name}}.rows"
import { FIND_{{upper}} } from "./persistence/{{name}}.sql"

interface {{Name}}Result {
    readonly id: string
}

@Injectable()
/** The {{name}} rows reached only through the shared primary EntityManager. */
export class {{Name}}Service {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers one row owned by the authenticated principal; absent and denied rows share one typed not-found result. */
    {{nameCamel}}(principalId: string, id: string): Promise<{{Name}}Result> {
        return requireOwnedRow<Pick<{{Name}}Row, "id">>(this.entityManager, FIND_{{upper}}, id, principalId, () => {
            throw new {{Name}}Error({ code: {{Name}}ErrorCode.NotFound, params: { id } })
        })
    }
}
