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
  accountControlOwnsDropdown,
  checkboxKeepsCompoundAnatomy,
  noInternalStarciHref,
  authOverlayOwnsSingleContentHost,
  fieldInputUsesSecondaryVariant,
  fieldLabelIsTextOnly,
  modalShellOwnsScrollBody,
  noSurfaceBranchInOverlay,
  rules,
  textLinkUsesHeroLink,
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
      { filename: "D:/repo/src/components/branches/SurfaceFormCard/index.tsx", code: "import { Card } from \"@heroui/react\"" },
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
    valid: [
      { filename: SHELL, code: "import { Modal } from \"@heroui/react\"" },
      {
        filename: "D:/repo/src/components/shells/DropdownShell/index.test.tsx",
        code: "export const Fixture = () => <span>Static identity</span>",
      },
    ],
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

test("VENDOR-6: ModalShell owns one zero-inset scroll body", () => {
  tester.run("modal-shell-owns-scroll-body", modalShellOwnsScrollBody, {
    valid: [{
      filename: SHELL,
      code: "export const S = ({ children }) => <Modal.Dialog><Modal.Body className='p-0'>{children}</Modal.Body></Modal.Dialog>",
    }],
    invalid: [
      {
        filename: SHELL,
        code: "export const S = ({ children }) => <Modal.Dialog>{children}</Modal.Dialog>",
        errors: [{ messageId: "missing" }],
      },
      {
        filename: SHELL,
        code: "export const S = ({ children }) => <Modal.Dialog><Modal.Body>{children}</Modal.Body></Modal.Dialog>",
        errors: [{ messageId: "inset" }],
      },
    ],
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

test("VENDOR-9: Field labels do not infer decorative kind icons", () => {
  const field = "D:/repo/src/components/leaves/Field/index.tsx"
  tester.run("field-label-is-text-only", fieldLabelIsTextOnly, {
    valid: [
      { filename: field, code: "export const Field = ({ label }) => <label>{label}</label>" },
      {
        filename: field,
        code: "import { Icon } from '@/components/leaves/Icon'; export const Field = () => <div><label>Password</label><button><Icon /></button></div>",
      },
    ],
    invalid: [{
      filename: field,
      code: "import { Icon } from '@/components/leaves/Icon'; export const Field = () => <label>Password <Icon /></label>",
      errors: [{ messageId: "icon" }],
    }],
  })
})

test("VENDOR-8: an overlay does not draw a surface inside itself", () => {
  const overlay = "D:/repo/src/components/overlays/auth/SignInOverlay/component.tsx"
  tester.run("no-surface-branch-in-overlay", noSurfaceBranchInOverlay, {
    valid: [{ filename: overlay, code: "import { ModalShell } from '@/components/shells/ModalShell'" }],
    invalid: [
      {
        filename: overlay,
        code: "import { SurfaceCard } from '@/components/branches/SurfaceCard'",
        errors: [{ messageId: "nested" }],
      },
      {
        filename: overlay,
        code: "import { SurfaceFormCard } from '@/components/branches/SurfaceFormCard'",
        errors: [{ messageId: "nested" }],
      },
    ],
  })
})

test("VENDOR-10: TextLink delegates hover and press behavior to HeroUI Link", () => {
  tester.run("text-link-uses-hero-link", textLinkUsesHeroLink, {
    valid: [{
      filename: "D:/repo/src/components/leaves/TextLink/index.tsx",
      code: "import { Link as HeroLink } from '@heroui/react'; export const TextLink = ({ label, press }) => <HeroLink onPress={press}>{label}</HeroLink>",
    }],
    invalid: [{
      filename: "D:/repo/src/components/leaves/TextLink/index.tsx",
      code: "export const TextLink = ({ label }) => <button className='hover:underline'>{label}</button>",
      errors: [{ messageId: "missing" }, { messageId: "handmade" }, { messageId: "handmade" }],
    }],
  })
})

test("VENDOR-11: the account block owns product choices while DropdownShell owns HeroUI", () => {
  tester.run("account-control-owns-dropdown", accountControlOwnsDropdown, {
    valid: [
      {
        filename: "D:/repo/src/components/shells/DropdownShell/index.tsx",
        code: "import { Dropdown } from '@heroui/react'; export const DropdownShell = () => <Dropdown />",
      },
      {
        filename: "D:/repo/src/components/blocks/auth/AccountMenu/component.tsx",
        code: "import { DropdownShell } from '@/components/shells/DropdownShell'; export const _AccountMenu = () => <DropdownShell />",
      },
      {
        filename: "D:/repo/src/components/layouts/ShellNav/component.tsx",
        code: "import { AccountMenu } from '@/components/blocks/auth/AccountMenu'; export const ShellNav = () => <AccountMenu />",
      },
    ],
    invalid: [
      {
        filename: "D:/repo/src/components/shells/DropdownShell/index.tsx",
        code: "export const DropdownShell = () => <div />",
        errors: [{ messageId: "dropdown" }],
      },
      {
        filename: "D:/repo/src/components/shells/DropdownShell/index.tsx",
        code: "import { Dropdown } from '@heroui/react'; export const DropdownShell = () => <Dropdown />; export const DropdownShellItem = Dropdown.Item",
        errors: [{ messageId: "pieces" }],
      },
      {
        filename: "D:/repo/src/components/blocks/auth/AccountMenu/component.tsx",
        code: "import { Dropdown } from '@heroui/react'; export const _AccountMenu = () => <Dropdown />",
        errors: [{ messageId: "vendor" }, { messageId: "shell" }],
      },
      {
        filename: "D:/repo/src/components/blocks/auth/AccountMenu/component.tsx",
        code: "import { DropdownShell, DropdownShellItem } from '@/components/shells/DropdownShell'; export const _AccountMenu = () => <DropdownShell><DropdownShellItem /></DropdownShell>",
        errors: [{ messageId: "pieces" }],
      },
      {
        filename: "D:/repo/src/components/layouts/ShellNav/component.tsx",
        code: "export const ShellNav = ({ openSignIn }) => <IconButton props={{ icon: 'account' }} on={{ press: openSignIn }} />",
        errors: [{ messageId: "menu" }, { messageId: "direct" }],
      },
    ],
  })
})

test("VENDOR-13: Checkbox keeps the vendor control inside its clickable content", () => {
  tester.run("checkbox-keeps-compound-anatomy", checkboxKeepsCompoundAnatomy, {
    valid: [{
      filename: "D:/repo/src/components/leaves/Checkbox/index.tsx",
      code: "export const Checkbox = () => <HeroCheckbox><HeroCheckbox.Content><HeroCheckbox.Control><HeroCheckbox.Indicator /></HeroCheckbox.Control><span>Remember me</span></HeroCheckbox.Content></HeroCheckbox>",
    }],
    invalid: [{
      filename: "D:/repo/src/components/leaves/Checkbox/index.tsx",
      code: "export const Checkbox = () => <HeroCheckbox><HeroCheckbox.Control><HeroCheckbox.Indicator /></HeroCheckbox.Control><HeroCheckbox.Content>Remember me</HeroCheckbox.Content></HeroCheckbox>",
      errors: [{ messageId: "anatomy" }],
    }],
  })
})

test("VENDOR-14: internal StarCi navigation is routed by connected actions", () => {
  tester.run("no-internal-starci-href", noInternalStarciHref, {
    valid: [
      {
        filename: "D:/repo/src/components/leaves/Link/index.tsx",
        code: "export const Link = ({ externalHref, press }) => <HeroLink href={externalHref} onPress={press} />",
      },
      {
        filename: "D:/repo/src/components/layouts/ShellNav/index.tsx",
        code: "const routes = [{ id: 'dashboard', path: '/dashboard' }]; router.push(routes[0].path)",
      },
    ],
    invalid: [
      {
        filename: "D:/repo/src/components/layouts/ShellNav/component.tsx",
        code: "export const Nav = () => <HeroLink href='/dashboard'>Dashboard</HeroLink>",
        errors: [{ messageId: "internal" }],
      },
      {
        filename: "D:/repo/src/components/blocks/auth/AuthenticationPanel/component.tsx",
        code: "const legal = { href: 'https://academy.starci.org/vi/terms' }",
        errors: [{ messageId: "internal" }],
      },
      {
        filename: "D:/repo/src/components/layouts/Footer/component.tsx",
        code: "const legal = { externalHref: 'https://academy.starci.org/vi/privacy' }",
        errors: [{ messageId: "internal" }],
      },
      {
        filename: "D:/repo/src/components/leaves/NavLink/index.tsx",
        code: "type NavLinkData = { readonly href: string }; export const NavLink = ({ props }) => <HeroLink href={props.href} />",
        errors: [{ messageId: "leaf" }, { messageId: "leaf" }],
      },
    ],
  })
})

test("VENDOR-12: the auth overlay has one zero-inset content host", () => {
  tester.run("auth-overlay-owns-single-content-host", authOverlayOwnsSingleContentHost, {
    valid: [
      {
        filename: "D:/repo/src/components/overlays/auth/SignInOverlay/component.tsx",
        code: "import { ContractContent } from '@/components/branches/Tree'; export const Overlay = ({ render }) => <ContractContent contract={render.meta.contract} render={render} />",
      },
      {
        // the same projection in a workspace that publishes its branches from a
        // package: the law is satisfied, so the rule must be too
        filename: "D:/repo/src/components/overlays/auth/SignInOverlay/component.tsx",
        code: "import { ContractContent } from '@acme/ui'; export const Overlay = ({ render }) => <ContractContent contract={render.meta.contract} render={render} />",
      },
      {
        filename: "D:/repo/src/components/contracts/index.ts",
        code: "const C = { 'centred-page-column': { classes: ['flex', 'gap-6'] } }",
      },
    ],
    invalid: [
      {
        filename: "D:/repo/src/components/overlays/auth/SignInOverlay/component.tsx",
        code: "import { Tree } from '@/components/branches/Tree'; export const Overlay = ({ render }) => <Tree contract={render.meta.contract} render={render} />",
        errors: [{ messageId: "missing" }, { messageId: "duplicate" }],
      },
      {
        // and a second host opened from a package is still a second host
        filename: "D:/repo/src/components/overlays/auth/SignInOverlay/component.tsx",
        code: "import { Tree } from '@acme/ui'; export const Overlay = ({ render }) => <Tree contract={render.meta.contract} render={render} />",
        errors: [{ messageId: "missing" }, { messageId: "duplicate" }],
      },
      {
        filename: "D:/repo/src/components/contracts/index.ts",
        code: "const C = { 'centred-page-column': { classes: ['flex', 'py-6'] } }",
        errors: [{ messageId: "inset" }],
      },
    ],
  })
})
