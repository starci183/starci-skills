// proves: HFS_SLOT_UNDECLARED@lite
// proves: HFS_SLOT_UNDECLARED@full
// proves: HFS_SLOT_AMBIGUOUS@lite
// proves: HFS_SLOT_AMBIGUOUS@full
// proves: HFS_SLOT_NOT_ENABLED@lite
// proves: HFS_SLOT_NOT_ENABLED@full
/**
 * RuleTester proofs of the registered back-end rule `slot-undeclared` (R01) for the three codes it reports, in lite and in full: a TypeScript
 * file is owned by exactly one enabled slot of the repository.
 *
 *   HFS_SLOT_UNDECLARED   no slot owns the path
 *   HFS_SLOT_NOT_ENABLED  an opt-in slot owns it and hfs.json neither lists nor implies that slot
 *   HFS_SLOT_AMBIGUOUS    two slots of equal specificity own it: a gap of the slot manifest, reported and never guessed
 *
 * The shipped manifest has no such gap (tests/hfs/hfs-slots.spec.mjs proves that every slot owns its own sample), so the ambiguous case runs the
 * same registered rule over a hermetic manifest: the shipped text plus two slots whose patterns differ only in the name of a variable, which the
 * manifest loader's literal duplicate-pattern check does not see. The rule reads that manifest through the fixtures-only `injectedRuntimeRoot` setting.
 *
 *   node --test slot-ownership.spec.mjs
 */
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
import { parseYaml } from "./runtime/engine/yaml.mjs"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const EXPORT = "export const value = 1;\n"
const SHIPPED = parseYaml(fs.readFileSync(path.join(import.meta.dirname, "runtime", "knowledge", "hfs", "slots.yaml"), "utf8"))
const TEMPLATE = SHIPPED.slots.find((slot) => slot.id === "repo.build-output")

/** The shipped manifest with two be slots of the same specificity over `src/twin/<name>/`. */
const twinManifest = () => {
    const twin = (id, name) => ({ ...TEMPLATE, id, profiles: ["be"], path: `src/twin/<${name}>/` })
    return JSON.stringify({ ...SHIPPED, slots: [...SHIPPED.slots, twin("be.twin.left", "left"), twin("be.twin.right", "right")] })
}

/** The one finding the rule reports on the visited file: its code and the machine's own sentence. */
const finding = (code, sentence) => ({ message: `[${code}] ${sentence}` })

for (const edition of ["lite", "full"]) {
    test(`${edition}: a TypeScript file no slot owns is HFS_SLOT_UNDECLARED, one a slot owns is not`, (t) => {
        const f = projectFixture({ edition, files: { "src/stray/thing.ts": EXPORT, "src/modules/domain/stock/index.ts": EXPORT } })
        t.after(f.cleanup)
        f.tester.run("slot-undeclared", rules["slot-undeclared"], {
            valid: [{ filename: f.at("src/modules/domain/stock/index.ts"), code: EXPORT }],
            invalid: [{ filename: f.at("src/stray/thing.ts"), code: EXPORT, errors: [finding("HFS_SLOT_UNDECLARED", "src/stray/thing.ts matches no slot; nearest slot be.tool-config (src/tests/tsconfig.json), matched src then expected tests")] }],
        })
    })

    test(`${edition}: a TypeScript file of an opt-in slot nobody declared is HFS_SLOT_NOT_ENABLED, once the pattern is declared it is not`, (t) => {
        const webhook = "src/features/webhooks/sepay/transport/http/sepay.webhook.ts"
        const rejected = projectFixture({ edition, files: { [webhook]: EXPORT } })
        t.after(rejected.cleanup)
        rejected.tester.run("slot-undeclared", rules["slot-undeclared"], {
            valid: [{ filename: rejected.at("apps/core/src/main.ts"), code: EXPORT }],
            invalid: [{ filename: rejected.at(webhook), code: EXPORT, errors: [finding("HFS_SLOT_NOT_ENABLED", `${webhook} belongs to be.feature.webhooks.http, an opt-in slot hfs.json neither lists in optionalSlots nor implies through an app kind`)] }],
        })
        const accepted = projectFixture({ edition, files: { [webhook]: EXPORT }, declaration: { patterns: ["webhooks"] } })
        t.after(accepted.cleanup)
        accepted.tester.run("slot-undeclared", rules["slot-undeclared"], {
            valid: [{ filename: accepted.at(webhook), code: EXPORT }],
            invalid: [],
        })
    })

    test(`${edition}: a TypeScript file two slots own equally is HFS_SLOT_AMBIGUOUS, the shipped manifest owns the same tree without it`, (t) => {
        const twin = "src/twin/one/a.ts"
        const gap = projectFixture({ edition, files: { [twin]: EXPORT, "src/modules/domain/stock/index.ts": EXPORT }, manifestText: twinManifest() })
        t.after(gap.cleanup)
        gap.tester.run("slot-undeclared", rules["slot-undeclared"], {
            valid: [{ filename: gap.at("src/modules/domain/stock/index.ts"), code: EXPORT }],
            invalid: [{ filename: gap.at(twin), code: EXPORT, errors: [{ message: /^\[HFS_SLOT_AMBIGUOUS\] src\/twin\/one\/a\.ts is owned equally by be\.twin\.left, be\.twin\.right$/ }] }],
        })
        const shipped = projectFixture({ edition, files: { [twin]: EXPORT } })
        t.after(shipped.cleanup)
        shipped.tester.run("slot-undeclared", rules["slot-undeclared"], {
            valid: [{ filename: shipped.at("apps/core/src/main.ts"), code: EXPORT }],
            invalid: [{ filename: shipped.at(twin), code: EXPORT, errors: [finding("HFS_SLOT_UNDECLARED", `${twin} matches no slot; nearest slot be.tests.world.kit (src/tests/world/kit/), matched src then expected tests`)] }],
        })
    })
}
