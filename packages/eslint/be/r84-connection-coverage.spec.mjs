/** R84 keeps database construction and the declared connection map behind one owner. */
// proves: BE_CONNECTION_DUPLICATE@lite
// proves: BE_CONNECTION_DUPLICATE@full
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { oneConnectionPerDatabase } from "./connections.mjs"
import { rules } from "./project-graph.mjs"

const DATABASE = "src/modules/platform/database"
const PRIMARY = `${DATABASE}/primary.connection.ts`
const BILLING = `${DATABASE}/billing.connection.ts`
const FILES = {
    [`${DATABASE}/index.ts`]: "export { PRIMARY_CONNECTION } from './primary.connection'; export { BILLING_CONNECTION } from './billing.connection';\n",
    [PRIMARY]: 'export const PRIMARY_CONNECTION = "primary";\n',
    [BILLING]: 'export const BILLING_CONNECTION = "wrong";\n',
    [`${DATABASE}/primary.decorators.ts`]: "import { getEntityManagerToken } from '@nestjs/typeorm'; import { PRIMARY_CONNECTION } from './primary.connection'; declare function injector(token: unknown): unknown; export const InjectPrimaryEntityManager = () => injector(getEntityManagerToken(PRIMARY_CONNECTION));\n",
    [`${DATABASE}/billing.decorators.ts`]: "import { getEntityManagerToken } from '@nestjs/typeorm'; import { BILLING_CONNECTION } from './billing.connection'; declare function injector(token: unknown): unknown; export const InjectBillingEntityManager = () => injector(getEntityManagerToken(BILLING_CONNECTION));\n",
    [`${DATABASE}/primary.config.ts`]: "export const primaryConfig = () => ({ host: process.env.PRIMARY_HOST });\n",
    [`${DATABASE}/billing.config.ts`]: "export const billingConfig = () => ({ host: process.env.BILLING_HOST });\n",
}

for (const edition of ["lite", "full"]) {
    test(`R84 accepts database-owned construction and rejects a domain connection in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const code = 'import { DataSource } from "typeorm"; export const source = new DataSource({})'
        ruleTester({ root: TYPED_ROOT, hfs }).run("one-connection-per-database", oneConnectionPerDatabase, {
            valid: [{ filename: at(`${DATABASE}/database.module.ts`), code }],
            invalid: [{ filename: at("src/modules/domain/order/order.service.ts"), code, errors: [{ messageId: "registration" }] }],
        })
    })
    test(`R84 accepts declared connection names and rejects a mismatched constant in ${edition}`, (t) => {
        const fixture = projectFixture({
            edition,
            files: FILES,
            declaration: { connections: [
                { name: "primary", envPrefix: "PRIMARY", owner: "core", isolation: "database" },
                { name: "billing", envPrefix: "BILLING", owner: "core", isolation: "database" },
            ] },
        })
        t.after(fixture.cleanup)
        fixture.tester.run("connection-map", rules["connection-map"], {
            valid: [{ filename: fixture.at(PRIMARY), code: FILES[PRIMARY] }],
            invalid: [{ filename: fixture.at(BILLING), code: FILES[BILLING], errors: [{ message: /BE_CONNECTION_DUPLICATE/ }] }],
        })
    })
}
