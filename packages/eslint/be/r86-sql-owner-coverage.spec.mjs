/** R86 SQL proofs exercise each edition's declared schema authority. */
// proves: BE_SQL_TABLE_OWNER@lite
// proves: BE_SQL_TABLE_OWNER@full
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const OWN_SQL = "src/modules/domain/purchase/persistence/purchase.sql.ts"
const FOREIGN_SQL = "src/modules/domain/purchase/persistence/foreign.sql.ts"
const UNBOUNDED_SQL = "src/modules/domain/purchase/persistence/unbounded.sql.ts"
const FILES = {
    "src/modules/platform/database/index.ts": "export { sql } from './sql';\n",
    "src/modules/platform/database/sql.ts": 'export const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => strings.join("?") + values.length;\n',
    "src/modules/domain/purchase/index.ts": "export const purchase = 1;\n",
    "src/modules/domain/identity/index.ts": "export const identity = 1;\n",
    "src/modules/domain/purchase/persistence/purchase.rows.ts": "export type PurchaseRow = { readonly id: string };\n",
    "src/modules/domain/identity/persistence/identity.rows.ts": "export type IdentityRow = { readonly id: string };\n",
    [OWN_SQL]: "import { sql } from '../../../platform/database';\nexport const READ = sql`SELECT id FROM purchase LIMIT 10`;\nexport const WRITE = sql`UPDATE purchase SET id = $1 WHERE id = $2`;\n",
    [FOREIGN_SQL]: "import { sql } from '../../../platform/database';\nexport const WRITE = sql`UPDATE identity SET id = $1 WHERE id = $2`;\n",
    [UNBOUNDED_SQL]: "import { sql } from '../../../platform/database';\nexport const READ = sql`SELECT id FROM purchase`;\n",
}
const ENTITIES = {
    "src/modules/domain/purchase/persistence/entities/purchase.entity.ts": 'import { Entity, PrimaryColumn } from "typeorm"; @Entity("purchase") export class PurchaseEntity { @PrimaryColumn({ type: "uuid" }) id!: string }\n',
    "src/modules/domain/identity/persistence/entities/identity.entity.ts": 'import { Entity, PrimaryColumn } from "typeorm"; @Entity("identity") export class IdentityEntity { @PrimaryColumn({ type: "uuid" }) id!: string }\n',
}
const DATABASE_TYPES = `export type Database = {
    public: {
        Tables: {
            purchase: { Row: { id: string }; Insert: { id: string }; Update: { id?: string }; Relationships: [] }
            identity: { Row: { id: string }; Insert: { id: string }; Update: { id?: string }; Relationships: [] }
        }
    }
}
`

for (const edition of ["lite", "full"]) {
    test(`R86 accepts bounded own-table SQL and rejects foreign writes and unbounded reads in ${edition}`, (t) => {
        const files = { ...FILES }
        if (edition === "full") Object.assign(files, ENTITIES)
        const fixture = projectFixture({
            edition,
            files,
            rootFiles: { "supabase/types/database.types.ts": DATABASE_TYPES },
        })
        t.after(fixture.cleanup)
        fixture.tester.run("sql-owner", rules["sql-owner"], {
            valid: [{ filename: fixture.at(OWN_SQL), code: FILES[OWN_SQL] }],
            invalid: [
                { filename: fixture.at(FOREIGN_SQL), code: FILES[FOREIGN_SQL], errors: [{ message: /BE_SQL_TABLE_OWNER/ }] },
                { filename: fixture.at(UNBOUNDED_SQL), code: FILES[UNBOUNDED_SQL], errors: [{ message: /BE_SQL_TABLE_OWNER/ }] },
            ],
        })
    })
}
