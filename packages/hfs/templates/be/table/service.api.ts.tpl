import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, requireOwnedRow } from "@modules/platform/database"
import { {{Name}}Error, {{Name}}ErrorCode } from "./errors/{{name}}.error"
import type { {{Name}}Row } from "./persistence/{{name}}.rows"
import { FIND_{{upper}}, INSERT_{{upper}} } from "./persistence/{{name}}.sql"

/** What the capability answers for one row: its id. */
type {{Name}}Result = Pick<{{Name}}Row, "id">

/** Throws the typed not-found error of one id: absent and denied rows share it. */
const notFound = (id: string): never => {
    throw new {{Name}}Error({ code: {{Name}}ErrorCode.NotFound, params: { id } })
}

/** The row an insert answered; an insert that answered none throws the typed not-created error. */
const createdRow = ([row]: ReadonlyArray<{{Name}}Result>): {{Name}}Result => {
    if (row === undefined) throw new {{Name}}Error({ code: {{Name}}ErrorCode.NotCreated })
    return row
}

@Injectable()
/** The {{name}} rows reached only through the shared primary EntityManager. */
export class {{Name}}Service {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers one row owned by the authenticated principal; absent and denied rows share one typed not-found result. */
    {{nameCamel}}(principalId: string, id: string): Promise<{{Name}}Result> {
        return requireOwnedRow<{{Name}}Result>(this.entityManager, FIND_{{upper}}, id, principalId, notFound)
    }

    /** Creates one row owned by the authenticated principal and answers its id. */
    create{{Singular}}(principalId: string): Promise<{{Name}}Result> {
        return this.entityManager.query<Array<{{Name}}Result>>(INSERT_{{upper}}, [principalId]).then(createdRow)
    }
}
