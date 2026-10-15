// proves: BE_SQL_RETURNING_SHAPE@lite
// proves: BE_SQL_RETURNING_SHAPE@full
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const GOOD = "src/modules/domain/stock/persistence/stock.sql.ts"
const BAD = "src/modules/domain/stock/persistence/stock-bad.sql.ts"
const FILES = {
    "src/modules/platform/database/index.ts": "export { sql } from './sql';\n",
    "src/modules/platform/database/sql.ts": 'export const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => strings.join("?") + values.length;\n',
    [GOOD]: [
        "import { sql } from '../../../platform/database';",
        "export const RELEASE = sql`WITH changed AS (UPDATE stock_items SET qty = qty + $2 WHERE id = $1 RETURNING id, qty) SELECT id, qty FROM changed`;",
        "export const PURGE = sql`WITH gone AS (DELETE FROM stock_items WHERE id = $1 RETURNING id) SELECT id FROM gone`;",
        "export const ADD = sql`INSERT INTO stock_items (id, qty) VALUES ($1, $2) RETURNING id`;",
        "export const BUMP = sql`UPDATE stock_items SET qty = qty + 1 WHERE id = $1`;",
        "export const NOTE = sql`UPDATE stock_items SET qty = 0 WHERE id = $1 /* RETURNING id */`;",
        "export const UPSERT = sql`INSERT INTO stock_items (id, qty) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET qty = EXCLUDED.qty RETURNING id`;",
        "",
    ].join("\n"),
    [BAD]: [
        "import { sql } from '../../../platform/database';",
        "export const TAKE = sql`UPDATE stock_items SET qty = qty - $2 WHERE id = $1 RETURNING id, qty`;",
        "export const DROP = sql`DELETE FROM stock_items WHERE id = $1 RETURNING id`;",
        "export const TWO = sql`SELECT 1; UPDATE stock_items SET qty = 0 WHERE id = $1 RETURNING id`;",
        "",
    ].join("\n"),
}

for (const edition of ["lite", "full"]) {
    test(`sql-returning accepts valid row results and rejects invalid bare RETURNING in ${edition}`, (t) => {
        const fixture = projectFixture({ edition, files: FILES })
        t.after(fixture.cleanup)
        fixture.tester.run("sql-returning", rules["sql-returning"], {
            valid: [{ filename: fixture.at(GOOD), code: FILES[GOOD] }],
            invalid: [{
                filename: fixture.at(BAD),
                code: FILES[BAD],
                errors: [
                    { message: /BE_SQL_RETURNING_SHAPE/, line: 2 },
                    { message: /BE_SQL_RETURNING_SHAPE/, line: 3 },
                    { message: /BE_SQL_RETURNING_SHAPE/, line: 4 },
                ],
            }],
        })
    })
}
