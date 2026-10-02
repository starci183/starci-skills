/**
 * Tests for `no-ambient-id` (R142 BE_AMBIENT_ID).
 *
 *   node --test ambient-id.spec.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noAmbientId } from "./ambient-id.mjs"

const tester = typedTester()
const IDS = at("src/modules/platform/ids/uuid-ids.service.ts")
const IDS_SPEC = at("src/modules/platform/ids/uuid-ids.service.spec.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const LOOKALIKE = at("src/modules/platform/idsworks/ids.service.ts")

test("every ambient id source is refused outside platform/ids, in specs too", () => {
    tester.run("no-ambient-id", noAmbientId, {
        valid: [
            // the one owner that mints ids, asked of the slot view
            { filename: IDS, code: "import { randomUUID } from 'node:crypto'\nexport const next = () => randomUUID()" },
            { filename: IDS_SPEC, code: "import { randomUUID } from 'crypto'\nexport const sample = randomUUID()" },
            // the test world is the composition root of tests
            { filename: at("src/tests/world/kit/names.ts"), code: "import { randomUUID } from 'node:crypto'\nexport const run = randomUUID()" },
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
