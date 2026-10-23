// proves: BE_AMBIENT_ID@lite
// proves: BE_AMBIENT_ID@full
/**
 * Tests for `no-ambient-id` (R142 BE_AMBIENT_ID).
 *
 *   node --test ambient-id.spec.mjs
 */
import test from "node:test"
import { at, ruleTester, TYPED_ROOT, BE_DECLARATION } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { noAmbientId } from "./ambient-id.mjs"

const IDS = at("src/modules/platform/ids/uuid-ids.service.ts")
const IDS_SPEC = at("src/modules/platform/ids/uuid-ids.service.spec.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const LOOKALIKE = at("src/modules/platform/idsworks/ids.service.ts")

for (const edition of ["lite", "full"]) {
    const declaration = { ...appDeclaration("be", BE_DECLARATION), edition }
    const tester = ruleTester({ root: TYPED_ROOT, hfs: hfsFromDeclaration(declaration, TYPED_ROOT) })
    test(`${edition} accepts owned and injected ids and rejects ambient id sources outside platform/ids, in specs and the test world too`, () => {
        tester.run("no-ambient-id", noAmbientId, {
            valid: [
                // the one owner that mints ids, asked of the slot view
                { filename: IDS, code: "import { randomUUID } from 'node:crypto'\nexport const next = () => randomUUID()" },
                { filename: IDS_SPEC, code: "import { randomUUID } from 'crypto'\nexport const sample = randomUUID()" },
                // business code asks the port; a spec provides fakeIds
                { filename: SERVICE, code: "export const id = this.ids.next()" },
                { filename: SPEC, code: "import { fakeIds } from '@starci/jest-preset'\nexport const ids = fakeIds(['a', 'b'])" },
                // other crypto, deterministic uuid versions and a local of the same name are not ambient ids
                { filename: SERVICE, code: "import { createHash, randomBytes } from 'node:crypto'\nexport const h = createHash('sha256')\nexport const b = randomBytes(4)" },
                { filename: SERVICE, code: "import { v5 } from 'uuid'\nexport const id = v5('x', 'ns')" },
                { filename: SERVICE, code: "const crypto = { randomUUID: () => 'fixed' }\nexport const id = crypto.randomUUID()" },
                { filename: SERVICE, code: "const randomUUID = () => 'fixed'\nexport const id = randomUUID()" },
            ],
            invalid: [
                // the test world is not exempt: it asks the injected Ids port
                { filename: at("src/tests/world/kit/names.ts"), code: "import { randomUUID } from 'node:crypto'\nexport const run = randomUUID()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "import { randomUUID } from 'node:crypto'\nexport const id = randomUUID()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "import { randomUUID as newId } from 'crypto'\nexport const id = newId()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "import * as nodeCrypto from 'node:crypto'\nexport const id = nodeCrypto.randomUUID()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "import crypto from 'crypto'\nexport const id = crypto.randomUUID()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "export const id = crypto.randomUUID()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "export const id = globalThis.crypto.randomUUID()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "import { v4 } from 'uuid'\nexport const id = v4()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "import { v7 as stamp } from 'uuid'\nexport const id = stamp()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "import { nanoid } from 'nanoid'\nexport const id = nanoid()", errors: [{ messageId: "id" }] },
                { filename: SERVICE, code: "import { ulid } from 'ulid'\nexport const id = ulid()", errors: [{ messageId: "id" }] },
                // a spec is not exempt, and a lookalike owner is not platform/ids
                { filename: SPEC, code: "import { randomUUID } from 'node:crypto'\nexport const id = randomUUID()", errors: [{ messageId: "id" }] },
                { filename: LOOKALIKE, code: "import { randomUUID } from 'node:crypto'\nexport const id = randomUUID()", errors: [{ messageId: "id" }] },
            ],
        })
    })
}
