/**
 * What is a unit spec, decided by the slot manifest and the file's role suffix, never by a path pattern.
 *
 * A unit spec is a `*.spec.ts` outside the folders that own the other test kinds (`src/tests/{e2e,integration,contract,world}`)
 * only. Only a `<name>.service.spec.ts` beside `<name>.service.ts` is a
 * legitimate unit spec (R47), and so is the spec of a door of a feature kind that has no service of its own
 * (`<provider>.webhook.spec.ts`, `<channel>.gateway.spec.ts`, `<channel>.subscription.spec.ts` beside its door, in the kind's slot);
 * the quality rules of R48 judge the service specs.
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

/**
 * The unit-tested roles of the back end: `ruleParams.be.unitRoles` of the slot manifest, the ONE list (`[{ role, spec, slot? }]`).
 *
 * @param {object} hfs - The HFS view.
 * @returns {ReadonlyArray<{ role: string, spec: string, slot?: string }>} The roles.
 */
export const unitRoles = (hfs) => hfs.ruleParams.unitRoles ?? []

/** Whether a role admits a file by its slot (a role with no slot admits any slot). */
const inRoleSlot = (hfs, role, filename) => role.slot === undefined || hfs.slotOf(filename) === role.slot

/**
 * The unit-tested role whose spec a file is (`<name>.<role>.spec.ts`, in the role's slot), or null.
 *
 * @param {object} hfs - The HFS view.
 * @param {string} filename - The linted file.
 * @returns {object | null} The role entry.
 */
export const unitRoleOfSpec = (hfs, filename) => {
    if (!isUnitSpecFile(hfs, filename)) return null
    const name = baseOf(filename)
    return unitRoles(hfs).find((role) => name.endsWith(`.${role.spec}.ts`) && inRoleSlot(hfs, role, filename)) ?? null
}

/**
 * The unit-tested role whose subject a file is (`<name>.<role>.ts`, in the role's slot, outside the test tree), or null.
 *
 * @param {object} hfs - The HFS view.
 * @param {string} filename - The linted file.
 * @returns {object | null} The role entry.
 */
export const unitRoleOfSubject = (hfs, filename) => {
    const name = baseOf(filename)
    const slot = hfs.slotOf(filename)
    if (!slot || slot.startsWith("be.tests.")) return null
    return unitRoles(hfs).find((role) => name.endsWith(`.${role.role}.ts`) && !name.endsWith(`.${role.spec}.ts`) && inRoleSlot(hfs, role, filename)) ?? null
}

/** The `<name>` of a `<name>.service.spec.ts`. */
export const serviceNameOfSpec = (filename) => baseOf(filename).replace(/\.service\.spec\.ts$/, "")

/** The slots of the feature kinds whose door carries its own unit spec beside it. */
const DOOR_SPEC_SLOTS = new Set(["be.feature.webhooks", "be.feature.realtime"])

/** The door a `<name>.<role>.spec.ts` of a feature kind tests, or null: `payment.webhook.spec.ts` gives `payment.webhook.ts`. */
export const doorOfSpec = (hfs, filename) => {
    if (!isUnitSpecFile(hfs, filename) || !DOOR_SPEC_SLOTS.has(hfs.slotOf(filename) ?? "")) return null
    const match = /^(.+.(?:webhook|gateway|subscription)).spec.ts$/.exec(baseOf(filename))
    return match ? `${match[1]}.ts` : null
}
