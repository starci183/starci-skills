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
import {
  mustDeepModuleImport,
  noSelfModuleAlias,
  noFolderReexport,
  noSelfGlobalModule,
  noRelativeCapabilityEscape,
  rules,
} from "./module-layering.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

const IN_AI = "D:/repo/src/modules/ai/ai-invoke.service.ts"
const IN_AI_MODULE = "D:/repo/src/modules/ai/ai.module.ts"
const IN_AI_SPEC = "D:/repo/src/modules/ai/ai.module.spec.ts"
const IN_AI_NESTED = "D:/repo/src/modules/ai/balancer/use-api.service.ts"
const IN_EXCEPTIONS = "D:/repo/src/modules/platform/exceptions/errors/abstract.ts"
const IN_FEATURE = "D:/repo/src/features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.ts"
const IN_AI_INDEX = "D:/repo/src/modules/ai/index.ts"
const IN_APP_ROOT = "D:/repo/apps/core/src/app.module.ts"

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

test("LAYERING-5 / Law 7: no file re-exports a folder", () => {
  tester.run("no-folder-reexport", noFolderReexport, {
    valid: [
      // a real bridging re-export names a FILE, not a folder -- explicitly legitimate under LAYERING-1
      { filename: IN_AI, code: "export { AiInvokeService } from '@modules/ai/ai-invoke.service'" },
      { filename: IN_AI, code: "import { X } from '@modules/databases/postgresql/primary/primary.module'" },
      { filename: IN_AI, code: "import { X } from '../databases/x.service'" },
      // named `index.ts` but NOT purely re-exports -- real content, not a barrel
      { filename: IN_AI_INDEX, code: "export class AiIndexThing {}" },
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
        // the file's ENTIRE content is re-exports and it is literally named index.ts
        filename: IN_AI_INDEX,
        code: "export { X } from './x.service'\nexport { Y } from './y.service'",
        errors: [{ messageId: "indexBarrel" }],
      },
      {
        filename: IN_AI_INDEX,
        code: "export * from './balancer/ai-balancer.module'",
        errors: [{ messageId: "indexBarrel" }],
      },
    ],
  })
})

test("LAYERING-4 / Law 6 (partial): a capability may not declare itself @Global()", () => {
  tester.run("no-self-global-module", noSelfGlobalModule, {
    valid: [
      // the composition root IS allowed to know this -- it is not inside any capability
      { filename: IN_APP_ROOT, code: "@Global()\n@Module({})\nclass RootWiring {}" },
      // a caller-supplied option threaded through, never hardcoded -- out of this rule's scope
      { filename: IN_AI_MODULE, code: "@Module({ imports: [AiPingModule.register({ isGlobal: false })] })\nclass AiModule {}" },
      // a spec file building its own throwaway TestingModule graph is not a production capability
      { filename: IN_AI_SPEC, code: "@Global()\n@Module({})\nclass RedisStubModule {}" },
      { filename: IN_AI_MODULE, code: "@Module({})\nclass AiModule {}" },
    ],
    invalid: [
      {
        filename: IN_AI_MODULE,
        code: "@Global()\n@Module({})\nclass AiModule {}",
        errors: [{ messageId: "global" }],
      },
      {
        // any file inside the capability, not just the *.module.ts one
        filename: IN_AI,
        code: "@Global()\n@Module({})\nclass SomeNestedThing {}",
        errors: [{ messageId: "global" }],
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
      { filename: IN_AI, code: "import { X } from '@modules/databases/postgresql/primary/primary.module'" },
      // a file outside every known capability root is out of scope for this law
      { filename: IN_APP_ROOT, code: "import { X } from '../shared/util'" },
    ],
    invalid: [
      {
        // walks out of `ai` into a sibling capability without ever naming the alias
        filename: IN_AI,
        code: "import { X } from '../databases/postgresql/primary/primary.module'",
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
