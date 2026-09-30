/**
 * Twin tests for the module-layering rules.
 *
 *   node --test module-layering.test.mjs
 *
 * HFS tiers are not capabilities: `@modules/domain` names a tier, while
 * `@modules/domain/ai` names the capability's explicit public index.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { fixtureHfs } from "./fixtures/typed/tester.mjs"
import {
  mustDeepModuleImport,
  noSelfModuleAlias,
  noFolderReexport,
  noRelativeCapabilityEscape,
  rules,
} from "./module-layering.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
  settings: { starci: { hfs: fixtureHfs() } },
})

const IN_AI = "D:/repo/src/modules/domain/ai/ai-invoke.service.ts"
const IN_AI_NESTED = "D:/repo/src/modules/domain/ai/balancer/use-api.service.ts"
const IN_EXCEPTIONS = "D:/repo/src/modules/platform/exceptions/errors/abstract.ts"
const IN_FEATURE = "D:/repo/src/features/courses/application/add-to-cart.use-case.ts"
const IN_AI_INDEX = "D:/repo/src/modules/domain/ai/index.ts"
const IN_APP_ROOT = "D:/repo/apps/core/src/app.module.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("LAYERING-1 (HFS): another owner is imported through its public entry, never through a path into it", () => {
  tester.run("must-deep-module-import", mustDeepModuleImport, {
    valid: [
      // the owner's index.ts: alias plus owner
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/ai'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/platform/logging'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/integrations/sepay'" },
      { filename: IN_APP_ROOT, code: "import { PlanModule } from '@features/plan'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/ai/index'" },
      { filename: IN_FEATURE, code: "import type { PlanSummary } from '@modules/domain/plan'" },
      // a test helper alias names a file under the test tree
      { filename: IN_FEATURE, code: "import { X } from '@tests/helpers/git-mount'" },
      // not an aliased import at all
      { filename: IN_FEATURE, code: "import { X } from './sibling'" },
      { filename: IN_FEATURE, code: "import { X } from '@nestjs/common'" },
      // reaching one's own owner through its alias is no-self-module-alias's finding, not this rule's
      { filename: IN_AI, code: "import { X } from '@modules/domain/ai/other'" },
    ],
    invalid: [
      { filename: IN_FEATURE, code: "import { X } from '@modules/'", errors: [{ messageId: "barrel" }] },
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain'", errors: [{ messageId: "barrel" }] },
      { filename: IN_FEATURE, code: "import { X } from '@modules/platform'", errors: [{ messageId: "barrel" }] },
      { filename: IN_FEATURE, code: "import { X } from '@tests/helpers'", errors: [{ messageId: "barrel" }] },
      { filename: IN_FEATURE, code: "export { X } from '@features/'", errors: [{ messageId: "barrel" }] },
      // a file of another owner is not its public surface
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/plan/plan.service'", errors: [{ messageId: "deep" }] },
      { filename: IN_FEATURE, code: "import { X } from '@modules/platform/exceptions/errors/abstract'", errors: [{ messageId: "deep" }] },
      { filename: IN_APP_ROOT, code: "import { X } from '@features/plan/application/create-plan.use-case'", errors: [{ messageId: "deep" }] },
      { filename: IN_FEATURE, code: "export { X } from '@modules/integrations/sepay/sepay.client'", errors: [{ messageId: "deep" }] },
      // the retired `lib` tier is no tier: `lib` reads as an owner and the rest as a path into it
      { filename: IN_FEATURE, code: "import { X } from '@modules/lib/ai'", errors: [{ messageId: "deep" }] },
    ],
  })
})

test("LAYERING-2: a capability does not reach itself through its own alias", () => {
  tester.run("no-self-module-alias", noSelfModuleAlias, {
    valid: [
      { filename: IN_AI, code: "import { X } from './ai-entitlement.service'" },
      // a DIFFERENT capability through its alias is the alias doing its job
      { filename: IN_AI, code: "import { X } from '@modules/domain/task/completion-authority.contracts'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/domain/ai'" },
      // a capability whose name merely starts the same way is not this capability
      { filename: IN_AI, code: "import { X } from '@modules/domain/ai-tools/thing.service'" },
    ],
    invalid: [
      {
        filename: IN_AI,
        code: "import { X } from '@modules/domain/ai/ai-entitlement.service'",
        errors: [{ messageId: "self" }],
      },
      {
        // reachable long and short, and both forms are the same capability talking to itself
        filename: IN_EXCEPTIONS,
        code: "import { X } from '@modules/platform/exceptions/errors/env/env-file-conflict'",
        errors: [{ messageId: "self" }],
      },
      {
        filename: IN_EXCEPTIONS,
        code: "import { X } from '@modules/exceptions/errors/env/env-file-conflict'",
        errors: [{ messageId: "self" }],
      },
    ],
  })
})

test("LAYERING-5 / Law 7: no file re-exports a folder", () => {
  tester.run("no-folder-reexport", noFolderReexport, {
    valid: [
      // a real bridging re-export names a FILE, not a folder -- explicitly legitimate under LAYERING-1
      { filename: IN_AI, code: "export { AiInvokeService } from '@modules/domain/ai/ai-invoke.service'" },
      { filename: IN_AI, code: "import { X } from '@modules/platform/postgresql/primary.module'" },
      { filename: IN_AI, code: "import { X } from '../databases/x.service'" },
      // an explicit public API can consist entirely of named re-exports
      { filename: IN_AI_INDEX, code: "export { AiInvokeService } from './ai-invoke.service'" },
      { filename: IN_AI_INDEX, code: "import { X } from './x.service'\nexport class Y { constructor() { X } }" },
      // pure re-exports, but the file is not named index.* -- a deliberate bridging file, not a barrel
      { filename: IN_AI, code: "export { X } from './x.service'\nexport { Y } from './y.service'" },
    ],
    invalid: [
      { filename: IN_AI, code: "export * from './'", errors: [{ messageId: "bareSpecifier" }] },
      { filename: IN_AI, code: "export * from '.'", errors: [{ messageId: "bareSpecifier" }] },
      { filename: IN_AI, code: "import { X } from '../'", errors: [{ messageId: "bareSpecifier" }] },
      {
        filename: IN_AI,
        code: "export * from '@modules/databases/postgresql/primary/'",
        errors: [{ messageId: "bareSpecifier" }],
      },
      {
        // export-star remains forbidden even beside an explicit named export
        filename: IN_AI_INDEX,
        code: "export { X } from './x.service'\nexport * from './y.service'",
        errors: [{ messageId: "indexBarrel" }],
      },
      {
        filename: IN_AI_INDEX,
        code: "export * from './balancer/ai-balancer.module'",
        errors: [{ messageId: "indexBarrel" }],
      },
      { filename: IN_AI_INDEX, code: "export type { A } from './types'", errors: [{ messageId: "typesFolder" }] },
      { filename: IN_AI_INDEX, code: "export type { A } from './types/index'", errors: [{ messageId: "typesFolder" }] },
      { filename: IN_AI_INDEX, code: "export { AI_STORE } from './ai.store'", errors: [{ messageId: "storeToken" }] },
      { filename: IN_AI_INDEX, code: "export const PLAN_STORE = 1", errors: [{ messageId: "storeToken" }] },
      {
        filename: IN_AI_INDEX,
        options: [{ maxExports: 2 }],
        code: "export { A } from './a'\nexport { B, C } from './b'",
        errors: [{ messageId: "tooWide" }],
      },
    ],
  })
})

test("Law 8: a relative import may not walk out of its own capability", () => {
  tester.run("no-relative-capability-escape", noRelativeCapabilityEscape, {
    valid: [
      // relative and staying inside the SAME capability -- exactly what LAYERING-2 asks for
      { filename: IN_AI, code: "import { X } from './ai-entitlement.service'" },
      { filename: IN_AI, code: "import { X } from './balancer/use-api.service'" },
      // a nested file walking back up but still landing inside its own capability
      { filename: IN_AI_NESTED, code: "import { X } from '../ai-entitlement.service'" },
      // aliased specifiers are LAYERING-1/2's job, not this rule's -- untouched here
      { filename: IN_AI, code: "import { X } from '@modules/platform/postgresql/primary.module'" },
      // a file outside every known capability root is out of scope for this law
      { filename: IN_APP_ROOT, code: "import { X } from '../shared/util'" },
    ],
    invalid: [
      {
        // walks out of `ai` into a sibling capability without ever naming the alias
        filename: IN_AI,
        code: "import { X } from '../task/completion-authority.contracts'",
        errors: [{ messageId: "escape" }],
      },
      {
        // the meta-root case: `platform/exceptions` walking sideways into `platform/env`
        filename: IN_EXCEPTIONS,
        code: "import { X } from '../../env/config'",
        errors: [{ messageId: "escape" }],
      },
    ],
  })
})
