import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
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
    async {{nameCamel}}(principalId: string, id: string): Promise<{{Name}}Result> {
        const rows = await this.entityManager.query<Array<Pick<{{Name}}Row, "id">>>(FIND_{{upper}}, [id, principalId])
        const row = rows[0]
        if (row === undefined) throw new {{Name}}Error({ code: {{Name}}ErrorCode.NotFound, params: { id } })
        return row
    }
}
