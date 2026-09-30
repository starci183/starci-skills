/**
 * What is a unit spec, decided by the slot manifest and the file's role suffix, never by a path pattern.
 *
 * A unit spec is a `*.spec.ts` outside the folders that own the other test kinds (`src/tests/{e2e,integration,contract,world}`)
 * only. Only a `<name>.service.spec.ts` beside `<name>.service.ts` is a
 * legitimate unit spec (R47); the quality rules of R48 judge exactly those.
 */
import { basename } from "node:path"

/** The slots whose `*.spec.ts` files are not unit specs: the other test kinds and world infrastructure. */
const OTHER_KIND_SLOTS = new Set(["be.tests.e2e", "be.tests.integration", "be.tests.contract", "be.tests.world", "be.tests.world.kit"])

/** The file name of a linted path. */
export const baseOf = (filename) => basename(String(filename || "").replace(/\\/g, "/"))

/**
 * Whether a file is a unit spec.
 *
 * @param {object} hfs - The HFS view.
 * @param {string} filename - The linted file.
 * @returns {boolean} True for a `*.spec.ts` that is not a spec of another test kind.
 */
export const isUnitSpecFile = (hfs, filename) => {
    if (!/\.spec\.[cm]?ts$/.test(baseOf(filename))) return false
    const found = hfs.classify(filename)
    return !OTHER_KIND_SLOTS.has(found.slot ?? "") && !OTHER_KIND_SLOTS.has(found.nearest?.slot ?? "")
}

/** Whether a file is a `<name>.service.spec.ts` unit spec. */
export const isServiceSpecFile = (hfs, filename) => /\.service\.spec\.ts$/.test(baseOf(filename)) && isUnitSpecFile(hfs, filename)

/** The `<name>` of a `<name>.service.spec.ts`. */
export const serviceNameOfSpec = (filename) => baseOf(filename).replace(/\.service\.spec\.ts$/, "")
