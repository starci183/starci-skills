/**
 * Twin tests for the module-layering rules.
 *
 *   node --test module-layering.test.mjs
 *
 * The meta-root is what these cases exist for. `@modules/ai` is a barrel and `@modules/platform` is
 * too, but `@modules/platform/exceptions` is ALSO a barrel while `@modules/ai/invoke.service` is
 * not -- the depth that counts as "names a file" differs by one under a category folder. A rule
 * that used one depth everywhere is wrong in both directions at once.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { mustDeepModuleImport, noSelfModuleAlias, rules } from "./module-layering.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const IN_AI = "D:/repo/src/modules/ai/ai-invoke.service.ts"
const IN_EXCEPTIONS = "D:/repo/src/modules/platform/exceptions/errors/abstract.ts"
const IN_FEATURE = "D:/repo/src/features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("LAYERING-1: a specifier must reach a file, and the depth differs under a meta-root", () => {
  tester.run("must-deep-module-import", mustDeepModuleImport, {
    valid: [
      { filename: IN_FEATURE, code: "import { X } from '@modules/ai/ai-invoke.service'" },
      // under a category folder the capability name is the SECOND segment, so this reaches a file
      { filename: IN_FEATURE, code: "import { X } from '@modules/platform/exceptions/errors/abstract'" },
      { filename: IN_FEATURE, code: "import { X } from '@features/api/core/thing.service'" },
      { filename: IN_FEATURE, code: "import { X } from '@tests/helpers/git-mount'" },
      // not an aliased import at all
      { filename: IN_FEATURE, code: "import { X } from './sibling'" },
      { filename: IN_FEATURE, code: "import { X } from '@nestjs/common'" },
    ],
    invalid: [
      { filename: IN_FEATURE, code: "import { X } from '@modules/ai'", errors: [{ messageId: "barrel" }] },
      {
        // a category folder alone names no capability, let alone a file
        filename: IN_FEATURE,
        code: "import { X } from '@modules/platform'",
        errors: [{ messageId: "barrel" }],
      },
      {
        // capability under a category folder, still no file
        filename: IN_FEATURE,
        code: "import { X } from '@modules/platform/exceptions'",
        errors: [{ messageId: "barrel" }],
      },
      { filename: IN_FEATURE, code: "import { X } from '@tests/helpers'", errors: [{ messageId: "barrel" }] },
      { filename: IN_FEATURE, code: "export { X } from '@features/api'", errors: [{ messageId: "barrel" }] },
    ],
  })
})

test("LAYERING-2: a capability does not reach itself through its own alias", () => {
  tester.run("no-self-module-alias", noSelfModuleAlias, {
    valid: [
      { filename: IN_AI, code: "import { X } from './ai-entitlement.service'" },
      // a DIFFERENT capability through its alias is the alias doing its job
      { filename: IN_AI, code: "import { X } from '@modules/databases/postgresql/primary/primary.module'" },
      { filename: IN_FEATURE, code: "import { X } from '@modules/ai/ai-invoke.service'" },
      // a capability whose name merely starts the same way is not this capability
      { filename: IN_AI, code: "import { X } from '@modules/ai-tools/thing.service'" },
    ],
    invalid: [
      {
        filename: IN_AI,
        code: "import { X } from '@modules/ai/ai-entitlement.service'",
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
