/**
 * Twin tests for the public-surface rules (R30).
 *
 *   node --test module-layering.spec.mjs
 *
 * Owners come from the HFS slot view and aliases from the program's `compilerOptions.paths`, so every case is a
 * typed virtual file under the fixture repository. HFS tiers are not owners: `@modules/domain` names a tier, while
 * `@modules/domain/plan` names the owner's public entry.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import {
  importOwnerEntry,
  noFolderReexport,
  noRelativeCapabilityEscape,
  noSelfModuleAlias,
  rules,
} from "./module-layering.mjs"

const tester = typedTester()

const IN_PLAN = at("src/modules/domain/plan/plan.service.ts")
const IN_PLAN_NESTED = at("src/modules/domain/plan/balancer/use-api.service.ts")
const IN_PLAN_INDEX = at("src/modules/domain/plan/index.ts")
const IN_LOGGING = at("src/modules/platform/logging/json-logger.service.ts")
const IN_FEATURE = at("src/features/api/checkout/application/place.handler.ts")
const IN_APP_ROOT = at("apps/api/src/app.module.ts")

test("every rule this law declares is exported under its published name, and the old name is gone", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
  assert.ok(rules["import-owner-entry"])
  assert.equal(rules["must-deep-module-import"], undefined)
})

test("R30: another owner is imported through its public entry, never through a path into it", () => {
  tester.run("import-owner-entry", importOwnerEntry, {
    valid: [
      // the owner's index.ts: alias plus owner
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/ai'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/platform/logging'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/integrations/sepay'" },
      { filename: IN_APP_ROOT, code: "import { PlanModule } from '@features/api/plan'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/ai/index'" },
      { filename: IN_FEATURE, code: "import type { PlanSummary } from '@modules/domain/plan'" },
      // a test helper alias names a file under the test tree: not an owner
      { filename: IN_FEATURE, code: "import { X } from '@tests/helpers/git-mount'" },
      // not an aliased import at all
      { filename: IN_FEATURE, code: "import { X } from '@nestjs/common'" },
      // same-owner imports are relative and name the file that declares the symbol
      { filename: IN_PLAN, code: "import { X } from './plan.contracts'" },
      { filename: IN_PLAN_NESTED, code: "import { X } from '../plan.service'" },
      // reaching one's own owner through its alias is no-self-module-alias's finding, not this rule's
      { filename: IN_PLAN, code: "import { X } from '@modules/domain/plan/other'" },
    ],
    invalid: [
      // a tier names no owner
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain'", errors: [{ messageId: "barrel" }] },
      { filename: IN_FEATURE, code: "import { X } from '@modules/platform'", errors: [{ messageId: "barrel" }] },
      { filename: IN_FEATURE, code: "import { X } from '@modules/integrations'", errors: [{ messageId: "barrel" }] },
      { filename: IN_FEATURE, code: "export { X } from '@features/api/'", errors: [{ messageId: "barrel" }] },
      // a file of another owner is not its public surface
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/plan/plan.service'", errors: [{ messageId: "deep" }] },
      { filename: IN_FEATURE, code: "import { X } from '@modules/platform/logging/logging.port'", errors: [{ messageId: "deep" }] },
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/plan/persistence/entities/plan.entity'", errors: [{ messageId: "deep" }] },
      { filename: IN_APP_ROOT, code: "import { X } from '@features/api/plan/application/create-plan.handler'", errors: [{ messageId: "deep" }] },
      { filename: IN_FEATURE, code: "export { X } from '@modules/integrations/sepay/sepay.client'", errors: [{ messageId: "deep" }] },
      // a same-owner import never goes through the owner's own index
      { filename: IN_PLAN, code: "import { X } from './index'", errors: [{ messageId: "ownIndex" }] },
      { filename: IN_PLAN_NESTED, code: "import { X } from '../index'", errors: [{ messageId: "ownIndex" }] },
      { filename: IN_FEATURE, code: "import { X } from '../index'", errors: [{ messageId: "ownIndex" }] },
    ],
  })
})

test("R30: an owner does not reach itself through its own alias", () => {
  tester.run("no-self-module-alias", noSelfModuleAlias, {
    valid: [
      { filename: IN_PLAN, code: "import { X } from './plan-entitlement.service'" },
      // a DIFFERENT owner through its alias is the alias doing its job
      { filename: IN_PLAN, code: "import { X } from '@modules/domain/task'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/plan'" },
      // an owner whose name merely starts the same way is not this owner
      { filename: IN_PLAN, code: "import { X } from '@modules/domain/plan-tools'" },
      { filename: IN_PLAN, code: "import { X } from '@nestjs/common'" },
    ],
    invalid: [
      { filename: IN_PLAN, code: "import { X } from '@modules/domain/plan/plan-entitlement.service'", errors: [{ messageId: "self" }] },
      { filename: IN_PLAN_NESTED, code: "import { X } from '@modules/domain/plan'", errors: [{ messageId: "self" }] },
      { filename: IN_LOGGING, code: "import { X } from '@modules/platform/logging'", errors: [{ messageId: "self" }] },
      { filename: IN_FEATURE, code: "import { X } from '@features/api/checkout'", errors: [{ messageId: "self" }] },
    ],
  })
})

/** An index that names `count` symbols from one file. */
const namesFrom = (count) => `export { ${Array.from({ length: count }, (_, index) => `N${index}`).join(", ")} } from './names'`

test("R30: no folder re-export, no nested index, and an owner's index holds only named export lines", () => {
  tester.run("no-folder-reexport", noFolderReexport, {
    valid: [
      // a real bridging re-export names a FILE, not a folder
      { filename: IN_PLAN, code: "export { AiInvokeService } from './ai-invoke.service'" },
      { filename: IN_PLAN, code: "import { X } from '../databases/x.service'" },
      // an explicit public API is named re-exports, value and type, at the owner root
      { filename: IN_PLAN_INDEX, code: "export { PlanService } from './plan.service'\nexport type { PlanSummary } from './plan.contracts'" },
      { filename: at("src/features/api/checkout/index.ts"), code: "export { CheckoutModule } from './checkout.module'" },
      // pure re-exports, but the file is not named index.* -- a deliberate bridging file, not a barrel
      { filename: IN_PLAN, code: "export { X } from './x.service'\nexport { Y } from './y.service'" },
      // the budget is inclusive
      { filename: IN_PLAN_INDEX, code: namesFrom(60) },
      // an app's own index is not an owner's
      { filename: at("apps/api/src/index.ts"), code: "export { X } from './x'" },
    ],
    invalid: [
      { filename: IN_PLAN, code: "export * from './'", errors: [{ messageId: "bareSpecifier" }] },
      { filename: IN_PLAN, code: "export * from '.'", errors: [{ messageId: "bareSpecifier" }] },
      { filename: IN_PLAN, code: "import { X } from '../'", errors: [{ messageId: "bareSpecifier" }] },
      { filename: IN_PLAN, code: "export * from '@modules/platform/database/'", errors: [{ messageId: "bareSpecifier" }] },
      // export-star remains forbidden even beside an explicit named export
      { filename: IN_PLAN_INDEX, code: "export { X } from './x.service'\nexport * from './y.service'", errors: [{ messageId: "indexBarrel" }] },
      { filename: IN_PLAN_INDEX, code: "export * from './balancer/plan-balancer.module'", errors: [{ messageId: "indexBarrel" }] },
      // an index is only export lines: no import, no declaration, no local export, no default
      { filename: IN_PLAN_INDEX, code: "import { X } from './x'\nexport { X } from './x'", errors: [{ messageId: "onlyNamedExports" }] },
      { filename: IN_PLAN_INDEX, code: "export const PLAN_LIMIT = 1", errors: [{ messageId: "onlyNamedExports" }] },
      { filename: IN_PLAN_INDEX, code: "export class Extra {}", errors: [{ messageId: "onlyNamedExports" }] },
      { filename: IN_PLAN_INDEX, code: "const X = 1\nexport { X }", errors: [{ messageId: "onlyNamedExports" }, { messageId: "onlyNamedExports" }] },
      { filename: IN_PLAN_INDEX, code: "export default 1", errors: [{ messageId: "onlyNamedExports" }] },
      // the surface is bounded
      { filename: IN_PLAN_INDEX, code: namesFrom(61), errors: [{ messageId: "tooWide" }] },
      { filename: IN_PLAN_INDEX, code: `${namesFrom(40)}\nexport { M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21 } from './more'`, errors: [{ messageId: "tooWide" }] },
      // a nested index is a second surface, wherever it sits below the owner root
      { filename: at("src/modules/domain/plan/persistence/index.ts"), code: "export { A } from './a'", errors: [{ messageId: "nestedIndex" }] },
      { filename: at("src/features/api/checkout/application/index.ts"), code: "export { A } from './a'", errors: [{ messageId: "nestedIndex" }] },
      { filename: at("src/modules/platform/logging/adapters/index.ts"), code: "export { A } from './a'", errors: [{ messageId: "nestedIndex" }] },
    ],
  })
})

test("R30: a relative import may not walk out of its own owner", () => {
  tester.run("no-relative-capability-escape", noRelativeCapabilityEscape, {
    valid: [
      // relative and staying inside the SAME owner
      { filename: IN_PLAN, code: "import { X } from './plan-entitlement.service'" },
      { filename: IN_PLAN, code: "import { X } from './balancer/use-api.service'" },
      // a nested file walking back up but still landing inside its own owner
      { filename: IN_PLAN_NESTED, code: "import { X } from '../plan-entitlement.service'" },
      // aliased specifiers are import-owner-entry's job
      { filename: IN_PLAN, code: "import { X } from '@modules/platform/database'" },
      // a file outside every owner is out of scope
      { filename: IN_APP_ROOT, code: "import { X } from '../shared/util'" },
    ],
    invalid: [
      // walks out of `plan` into a sibling owner without ever naming the alias
      { filename: IN_PLAN, code: "import { X } from '../task/completion-authority.contracts'", errors: [{ messageId: "escape" }] },
      // sideways between platform owners
      { filename: IN_LOGGING, code: "import { X } from '../config/env-source.config'", errors: [{ messageId: "escape" }] },
      // between features
      { filename: IN_FEATURE, code: "import { X } from '../../cart/application/add.handler'", errors: [{ messageId: "escape" }] },
    ],
  })
})
