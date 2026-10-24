// proves: BE_SCHEMA_PLACE@lite
// proves: BE_SCHEMA_PLACE@full
// proves: BE_SCHEMA_BOUNDED@lite
// proves: BE_SCHEMA_BOUNDED@full
/**
 * Twin tests for the boundary-schema rules (R304 `BE_SCHEMA_PLACE`, R305 `BE_SCHEMA_BOUNDED`).
 *
 *   node --test boundary-schema.spec.mjs
 *
 * A schema is bounded by what its chain says, so the cases rename variables and aliases freely: the namespace, a renamed
 * `z` and a named constructor import all count as zod.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { recommended, rules, schemaBounded, schemaPlace } from "./boundary-schema.mjs"

const SCHEMA = at("src/modules/integrations/sepay/sepay-transactions.schema.ts")
const SCHEMA_SPEC = at("src/modules/integrations/sepay/sepay-transactions.schema.spec.ts")
const PLATFORM_SCHEMA = at("src/modules/platform/queue/queue-payload.schema.ts")
const DOMAIN_SCHEMA = at("src/modules/domain/order/order-payload.schema.ts")
const READER = at("src/modules/integrations/sepay/sepay-transactions.mapper.ts")
const FEATURE = at("src/features/api/plan/application/create-plan.handler.ts")
const FEATURE_SCHEMA = at("src/features/api/plan/application/create-plan.schema.ts")
const DOOR = at("src/features/api/plan/transport/graphql/create-plan.resolver.ts")
const DTO = at("src/features/api/plan/transport/graphql/dto/create-plan.input.ts")
const WEBHOOK_DTO = at("src/features/webhooks/sepay/transport/http/dto/sepay.request.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const WORLD = at("src/tests/world/helper.ts")

const Z = "import { z } from 'zod'\n"

test("every rule this law declares is exported under its published name, at error", () => {
    for (const [name, rule] of Object.entries(rules)) {
        assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
        assert.equal(recommended[`starci-be/${name}`], "error")
    }
    assert.deepEqual(Object.keys(rules).sort(), ["schema-bounded", "schema-place"])
})

for (const edition of ["lite", "full"]) {
    const tester = ruleTester({ root: TYPED_ROOT, hfs: hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT) })
    test(`${edition} R305: every string, array, set, map and record is bounded`, () => {
        tester.run("schema-bounded", schemaBounded, {
            valid: [
                { filename: SCHEMA, code: `${Z}export const A = z.object({ id: z.string().max(64) })` },
                { filename: SCHEMA, code: `${Z}export const A = z.string().trim().min(1).max(64).optional()` },
                { filename: SCHEMA, code: `${Z}export const A = z.string().length(26)` },
                { filename: SCHEMA, code: `${Z}export const A = z.array(z.string().max(8)).max(100)` },
                { filename: SCHEMA, code: `${Z}export const A = z.array(z.number()).length(3)` },
                { filename: SCHEMA, code: `${Z}export const A = z.set(z.string().max(8)).max(4)` },
                { filename: SCHEMA, code: `${Z}const MAX = 50\nexport const A = z.array(z.string().max(MAX)).max(MAX)` },
                { filename: SCHEMA, code: `${Z}export const A = z.coerce.string().max(20)` },
                { filename: SCHEMA, code: `${Z}export const A = z.email().max(254)` },
                { filename: SCHEMA, code: `${Z}export const A = z.record(z.string().max(32), z.number()).refine((entries) => Object.keys(entries).length <= 20)` },
                { filename: SCHEMA, code: `${Z}export const A = z.map(z.string().max(8), z.number()).check(z.maxSize(5))` },
                { filename: SCHEMA, code: `${Z}export const A = z.record(z.enum(["a", "b"]), z.number()).refine((entries) => Object.keys(entries).length <= 2)` },
                // enums, literals, numbers, booleans, dates and a fixed-format uuid owe no length
                { filename: SCHEMA, code: `${Z}export const A = z.object({ k: z.enum(["a", "b"]), n: z.literal("x"), c: z.number().int(), b: z.boolean(), u: z.uuid(), d: z.iso.datetime() })` },
                { filename: SCHEMA, code: `${Z}export const A = z.tuple([z.string().max(4), z.number()])` },
                // an alias of the namespace and a named import both count as zod
                { filename: SCHEMA, code: "import { z as zod } from 'zod'\nexport const A = zod.string().max(5)" },
                { filename: SCHEMA, code: "import * as v from 'zod'\nexport const A = v.string().max(5)" },
                { filename: SCHEMA, code: "import { string, array } from 'zod'\nexport const A = array(string().max(5)).max(5)" },
                { filename: SCHEMA, code: "import { z } from 'zod/v4'\nexport const A = z.string().max(5)" },
                // a `string()` or `array()` of another library is not zod
                { filename: SCHEMA, code: "declare const z: { string(): unknown }\nexport const A = z.string()" },
                { filename: SCHEMA, code: "import { string } from 'yup'\nexport const A = string()" },
                // a file without zod is not judged
                { filename: READER, code: "export const A = [1, 2, 3]" },
            ],
            invalid: [
                { filename: SCHEMA, code: `${Z}export const A = z.string()`, errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.string().trim().min(1).optional()`, errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.string().regex(/^[a-z]+$/)`, errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.coerce.string()`, errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.email()`, errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.url()`, errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.array(z.string().max(8))`, errors: [{ messageId: "counted" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.array(z.string()).max(10)`, errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.array(z.string()).min(1)`, errors: [{ messageId: "counted" }, { messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.set(z.number())`, errors: [{ messageId: "counted" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.record(z.string().max(8), z.number())`, errors: [{ messageId: "refined" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.record(z.string(), z.number()).refine((entries) => Object.keys(entries).length <= 2)`, errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.map(z.string().max(8), z.number())`, errors: [{ messageId: "refined" }] },
                // a bound that is none: infinite, non-positive, missing or the widest number
                { filename: SCHEMA, code: `${Z}export const A = z.string().max(Infinity)`, errors: [{ messageId: "bound" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.string().max()`, errors: [{ messageId: "bound" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.string().max(0)`, errors: [{ messageId: "bound" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.array(z.number()).max(Number.MAX_SAFE_INTEGER)`, errors: [{ messageId: "bound" }] },
                // nested inside an object: the leaf still owes its bound
                { filename: SCHEMA, code: `${Z}export const A = z.object({ items: z.array(z.object({ name: z.string() })).max(5) })`, errors: [{ messageId: "string" }] },
                // an open schema validates nothing
                { filename: SCHEMA, code: `${Z}export const A = z.any()`, errors: [{ messageId: "open" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.object({ payload: z.unknown() })`, errors: [{ messageId: "open" }] },
                { filename: SCHEMA, code: `${Z}export const A = z.json()`, errors: [{ messageId: "open" }] },
                // an aliased namespace and a named import cannot hide an unbounded schema
                { filename: SCHEMA, code: "import { z as zod } from 'zod'\nexport const A = zod.string()", errors: [{ messageId: "string" }] },
                { filename: SCHEMA, code: "import { string } from 'zod'\nexport const A = string()", errors: [{ messageId: "string" }] },
                // a spec of a schema is judged like the schema
                { filename: SCHEMA_SPEC, code: `${Z}export const A = z.string()`, errors: [{ messageId: "string" }] },
            ],
        })
    })

    test(`${edition} R304: zod lives in a schema file of a domain, platform or integrations owner`, () => {
        tester.run("schema-place", schemaPlace, {
            valid: [
                { filename: SCHEMA, code: `${Z}export const A = z.string().max(5)` },
                { filename: SCHEMA_SPEC, code: `${Z}export const A = z.string().max(5)` },
                { filename: PLATFORM_SCHEMA, code: `${Z}export const A = z.string().max(5)` },
                { filename: DOMAIN_SCHEMA, code: `${Z}export const A = z.string().max(5)` },
                { filename: SCHEMA, code: "import { z } from 'zod/v4'\nexport const A = z.string().max(5)" },
                // the reader imports the schema, never zod
                { filename: READER, code: "import { SepayTransactions } from './sepay-transactions.schema'\nexport const read = (value: unknown) => SepayTransactions.safeParse(value)" },
                // class-validator in a door is the other layer and owes nothing here
                { filename: DTO, code: "import { IsString, MaxLength } from 'class-validator'\nexport class CreatePlanInput { @IsString() @MaxLength(5) name!: string }" },
                // a module that merely mentions zod in text is not importing it
                { filename: READER, code: "export const note = 'zod'" },
            ],
            invalid: [
                { filename: DTO, code: `${Z}export const A = z.string().max(5)`, errors: [{ messageId: "door" }] },
                { filename: DOOR, code: `${Z}export const A = z.string().max(5)`, errors: [{ messageId: "door" }] },
                { filename: WEBHOOK_DTO, code: `${Z}export const A = z.string().max(5)`, errors: [{ messageId: "door" }] },
                { filename: FEATURE, code: `${Z}export const A = z.string().max(5)`, errors: [{ messageId: "tier" }] },
                // a schema file of a feature is still a feature
                { filename: FEATURE_SCHEMA, code: `${Z}export const A = z.string().max(5)`, errors: [{ messageId: "tier" }] },
                { filename: READER, code: `${Z}export const A = z.string().max(5)`, errors: [{ messageId: "file" }] },
                { filename: SERVICE, code: `${Z}export const A = z.string().max(5)`, errors: [{ messageId: "file" }] },
                { filename: WORLD, code: `${Z}export const A = z.string().max(5)`, errors: [{ messageId: "file" }] },
                // every route to the module is a reference
                { filename: READER, code: "export const load = () => import('zod')", errors: [{ messageId: "file" }] },
                { filename: READER, code: "export { z } from 'zod'", errors: [{ messageId: "file" }] },
                { filename: READER, code: "declare function require(name: string): unknown\nexport const z = require('zod')", errors: [{ messageId: "file" }] },
                // the two layers never share a file
                { filename: SCHEMA, code: `${Z}import { IsString } from 'class-validator'\nexport class A { @IsString() id!: string }`, errors: [{ messageId: "mixed" }] },
                { filename: SCHEMA, code: `${Z}import { Field } from '@nestjs/graphql'\nexport const x = Field`, errors: [{ messageId: "mixed" }] },
            ],
        })
    })
}
