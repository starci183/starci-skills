/**
 * Twin tests for the vendor-boundary rule.
 *
 *   node --test vendor-boundary.test.mjs
 *
 * Two cases carry this suite. The provider outside the component tree must stay valid, or the rule
 * forbids the one file that has to stand the library up. And the empty shell must fail, or the
 * folder is an exemption anybody can opt into - which is the same hole with a nicer name.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  fieldInputUsesSecondaryVariant,
  modalShellPassesContentDirectly,
  noSurfaceBranchInOverlay,
  rules,
  vendorBoundary,
} from "./vendor-boundary.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const LEAF = "D:/repo/src/components/leaves/Button/index.tsx"
const SHELL = "D:/repo/src/components/shells/ModalShell/index.tsx"
const BRANCH = "D:/repo/src/components/branches/SurfaceCard/index.tsx"
const BLOCK = "D:/repo/src/components/blocks/dashboard/DailyQuest/component.tsx"
const PROVIDER = "D:/repo/src/app/providers.tsx"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("VENDOR-1: the library belongs to closed primitives, covering shells and named surface branches", () => {
  tester.run("vendor-boundary", vendorBoundary, {
    valid: [
      { filename: LEAF, code: "import { Button } from \"@heroui/react\"" },
      { filename: SHELL, code: "import { Modal } from \"@heroui/react\"" },
      // outside the component tree: standing the library up is not reaching past a tier
      { filename: PROVIDER, code: "import { HeroUIProvider } from \"@heroui/react\"" },
      { filename: BRANCH, code: "import { Card } from \"@heroui/react\"" },
    ],
    invalid: [
      { filename: "D:/repo/src/components/branches/GenericPanel/index.tsx", code: "import { Modal } from \"@heroui/react\"", errors: [{ messageId: "outside" }] },
      { filename: BLOCK, code: "import { Button } from \"@heroui/react\"", errors: [{ messageId: "outside" }] },
      // a subpath does not walk around the boundary
      { filename: BLOCK, code: "import { X } from \"@heroui/theme\"", errors: [{ messageId: "outside" }] },
    ],
  })
})

test("VENDOR-2: a shell that wraps nothing is an ordinary component in the wrong folder", () => {
  tester.run("vendor-boundary", vendorBoundary, {
    valid: [{ filename: SHELL, code: "import { Modal } from \"@heroui/react\"" }],
    invalid: [
      {
        filename: SHELL,
        code: "import { Tree } from \"@/components/branches/Tree\"",
        errors: [{ messageId: "emptyShell" }],
      },
      {
        filename: "D:/repo/src/components/shells/SurfaceCard/index.tsx",
        code: "import { Tree } from \"@/components/branches/Tree\"",
        errors: [{ messageId: "unknownShell" }],
      },
    ],
  })
})

test("VENDOR-6: ModalShell leaves its interior uninterpreted", () => {
  tester.run("modal-shell-passes-content-directly", modalShellPassesContentDirectly, {
    valid: [{
      filename: SHELL,
      code: "export const S = ({ children }) => <Modal.Dialog><Modal.CloseTrigger />{children}</Modal.Dialog>",
    }],
    invalid: [{
      filename: SHELL,
      code: "export const S = ({ children }) => <Modal.Dialog><Modal.Body>{children}</Modal.Body></Modal.Dialog>",
      errors: [{ messageId: "body" }],
    }],
  })
})

test("VENDOR-7: Field uses the secondary input variant on its bounded surface", () => {
  const field = "D:/repo/src/components/leaves/Field/index.tsx"
  tester.run("field-input-uses-secondary-variant", fieldInputUsesSecondaryVariant, {
    valid: [{
      filename: field,
      code: "import { Input as HeroInput } from '@heroui/react'; export const Field = () => <HeroInput variant='secondary' />",
    }],
    invalid: [{
      filename: field,
      code: "import { Input } from '@heroui/react'; export const Field = () => <Input />",
      errors: [{ messageId: "variant" }],
    }],
  })
})

test("VENDOR-8: an overlay does not draw a surface inside itself", () => {
  const overlay = "D:/repo/src/components/overlays/auth/SignInOverlay/component.tsx"
  tester.run("no-surface-branch-in-overlay", noSurfaceBranchInOverlay, {
    valid: [{ filename: overlay, code: "import { ModalShell } from '@/components/shells/ModalShell'" }],
    invalid: [{
      filename: overlay,
      code: "import { SurfaceCard } from '@/components/branches/SurfaceCard'",
      errors: [{ messageId: "nested" }],
    }],
  })
})
