// proves: BE_PUBLIC_SURFACE@lite
// proves: BE_PUBLIC_SURFACE@full
// proves: ARCH_OWNER_EXPORT_BYPASS@lite
// proves: ARCH_OWNER_EXPORT_BYPASS@full
// proves: ARCH_OWNER_EXPORT_STAR@lite
// proves: ARCH_OWNER_EXPORT_STAR@full
// proves: HFS_ALIAS_REEXPORT@lite
// proves: HFS_ALIAS_REEXPORT@full
// proves: ARCH_PACKAGE_EXPORT_BYPASS@lite
// proves: ARCH_PACKAGE_EXPORT_BYPASS@full
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from "./fixtures/typed/tester.mjs"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { importOwnerEntry, noFolderReexport, noRelativeCapabilityEscape, noSelfModuleAlias } from "./module-layering.mjs"
import { rules as beGraphRules } from "./project-graph.mjs"
import { rules as feGraphRules } from "../fe/project-graph.mjs"

const plan = at("src/modules/domain/plan/plan.service.ts")
const planIndex = at("src/modules/domain/plan/index.ts")
const integrationIndex = at("src/modules/integrations/data-sources/index.ts")
const feature = at("src/features/api/checkout/application/place.handler.ts")
const namedExports = count => "export { " + Array.from({ length: count }, (_, index) => "Name" + index).join(", ") + " } from './names'"

const aliasFiles = base => ({
    [base + "/index.ts"]: "export { Original, Shape } from './original'\n",
    [base + "/original.ts"]: "export class Original {}\nexport interface Shape { readonly id: string }\n",
    [base + "/aliases.ts"]: [
        "import { Original, Shape } from './original'",
        "export const Renamed = Original",
        "export type RenamedShape = Shape",
        "export interface AnotherShape extends Shape {}",
        "export { Original as Moved } from './original'",
        "",
    ].join("\n"),
})

const packageFiles = profile => ({
    "../package.json": JSON.stringify({ private: true, workspaces: [profile + "/packages/*", ...(profile === "fe" ? ["fe/apps/*"] : [])] }),
    "tsconfig.json": JSON.stringify({
        compilerOptions: {
            target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", noEmit: true,
            baseUrl: ".", paths: { "@fixture/ui": ["packages/ui/src/index.ts"], "@fixture/ui/*": ["packages/ui/src/*/index.ts"] },
        },
        include: ["apps/**/*", "packages/**/*"],
    }),
    ...(profile === "fe" ? { "apps/web/package.json": JSON.stringify({ name: "@fixture/web", private: true }) } : {}),
    "packages/ui/package.json": JSON.stringify({ name: "@fixture/ui", private: true, exports: { ".": "./src/index.ts", "./public": "./src/public/index.ts" } }),
    "packages/ui/src/index.ts": "export const ui = 1\n",
    "packages/ui/src/public/index.ts": "export const Public = 1\n",
    "packages/ui/src/private/index.ts": "export const Private = 1\n",
})

for (const edition of ["lite", "full"]) {
    test(`R30 ${edition} accepts valid owner entries and rejects invalid public-surface syntax`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        const tester = ruleTester({ root: TYPED_ROOT, hfs })
        tester.run("import-owner-entry", importOwnerEntry, {
            valid: [
                { filename: feature, code: "import { Plan } from '@modules/domain/plan'" },
                { filename: plan, code: "import { Plan } from './plan.contracts'" },
            ],
            invalid: [
                { filename: feature, code: "import { Plan } from '@modules/domain/plan/plan.service'", errors: [{ messageId: "deep" }] },
                { filename: feature, code: "import { Plan } from '@modules/domain'", errors: [{ messageId: "barrel" }] },
                { filename: plan, code: "import { Plan } from './index'", errors: [{ messageId: "ownIndex" }] },
            ],
        })
        tester.run("no-self-module-alias", noSelfModuleAlias, {
            valid: [{ filename: plan, code: "import { Plan } from './plan.contracts'" }],
            invalid: [{ filename: plan, code: "import { Plan } from '@modules/domain/plan'", errors: [{ messageId: "self" }] }],
        })
        tester.run("no-relative-capability-escape", noRelativeCapabilityEscape, {
            valid: [{ filename: plan, code: "import { Plan } from './plan.contracts'" }],
            invalid: [{ filename: plan, code: "import { Task } from '../task/task.service'", errors: [{ messageId: "escape" }] }],
        })
        tester.run("no-folder-reexport", noFolderReexport, {
            valid: [
                { filename: planIndex, code: "export { Plan } from './plan.service'\nexport type { PlanSummary } from './plan.contracts'" },
                { filename: planIndex, code: namedExports(60) },
                { filename: integrationIndex, code: namedExports(80) },
            ],
            invalid: [
                { filename: plan, code: "export * from './'", errors: [{ messageId: "bareSpecifier" }] },
                { filename: planIndex, code: "export * from './plan.service'", errors: [{ messageId: "indexBarrel" }] },
                { filename: planIndex, code: "export const Plan = 1", errors: [{ messageId: "onlyNamedExports" }] },
                { filename: at("src/modules/domain/plan/persistence/index.ts"), code: "export { Plan } from './plan.entity'", errors: [{ messageId: "nestedIndex" }] },
                { filename: planIndex, code: namedExports(61), errors: [{ messageId: "tooWide", data: { count: 61, max: 60 } }] },
                { filename: integrationIndex, code: namedExports(81), errors: [{ messageId: "tooWide", data: { count: 81, max: 80 } }] },
            ],
        })
    })

    test(`R30 ${edition} BE accepts valid public imports and rejects invalid owner bypass and export star`, t => {
        const files = {
            "src/modules/domain/plan/index.ts": "export { Plan } from './plan.service'\n",
            "src/modules/domain/plan/plan.service.ts": "export class Plan {}\n",
            "src/modules/domain/task/task.service.ts": "import { Plan } from '../plan'\nexport const read = () => Plan\n",
            "src/modules/domain/deep/deep.service.ts": "import { Plan } from '../plan/plan.service'\nexport const read = () => Plan\n",
            "src/modules/domain/star/index.ts": "export * from './star.service'\n",
            "src/modules/domain/star/star.service.ts": "export const Star = 1\n",
        }
        const f = projectFixture({ edition, files })
        t.after(f.cleanup)
        f.tester.run("owner-export-bypass", beGraphRules["owner-export-bypass"], {
            valid: [{ filename: f.at("src/modules/domain/task/task.service.ts"), code: files["src/modules/domain/task/task.service.ts"] }],
            invalid: [
                { filename: f.at("src/modules/domain/deep/deep.service.ts"), code: files["src/modules/domain/deep/deep.service.ts"], errors: [{ message: /\[ARCH_OWNER_EXPORT_BYPASS\]/, line: 1 }] },
                { filename: f.at("src/modules/domain/star/index.ts"), code: files["src/modules/domain/star/index.ts"], errors: [{ message: /\[ARCH_OWNER_EXPORT_STAR\]/, line: 1 }] },
            ],
        })
    })

    test(`R30 ${edition} FE accepts valid public imports and rejects invalid owner bypass and export star`, t => {
        const files = {
            "apps/web/src/hooks/cart/index.ts": "export { useCart } from './useCart'\n",
            "apps/web/src/hooks/cart/useCart.ts": "export const useCart = () => 1\n",
            "apps/web/src/hooks/shop/index.ts": "import { useCart } from '../cart'\nexport const useShop = () => useCart()\n",
            "apps/web/src/hooks/orders/index.ts": "import { useCart } from '../cart/useCart'\nexport const useOrders = () => useCart()\n",
            "apps/web/src/hooks/dom/index.ts": "export * from './useDom'\n",
            "apps/web/src/hooks/dom/useDom.ts": "export const useDom = () => 1\n",
        }
        const f = projectFixture({ profile: "fe", edition, files })
        t.after(f.cleanup)
        f.tester.run("owner-export-bypass", feGraphRules["owner-export-bypass"], {
            valid: [{ filename: f.at("apps/web/src/hooks/shop/index.ts"), code: files["apps/web/src/hooks/shop/index.ts"] }],
            invalid: [
                { filename: f.at("apps/web/src/hooks/orders/index.ts"), code: files["apps/web/src/hooks/orders/index.ts"], errors: [{ message: /\[ARCH_OWNER_EXPORT_BYPASS\]/, line: 1 }] },
                { filename: f.at("apps/web/src/hooks/dom/index.ts"), code: files["apps/web/src/hooks/dom/index.ts"], errors: [{ message: /\[ARCH_OWNER_EXPORT_STAR\]/, line: 1 }] },
            ],
        })
    })

    test(`R30 ${edition} BE accepts valid declarations and rejects invalid alias reexports`, t => {
        const base = "src/modules/domain/named"
        const files = aliasFiles(base)
        const f = projectFixture({ edition, files })
        t.after(f.cleanup)
        f.tester.run("alias-reexport", beGraphRules["alias-reexport"], {
            valid: [{ filename: f.at(base + "/index.ts"), code: files[base + "/index.ts"] }],
            invalid: [{ filename: f.at(base + "/aliases.ts"), code: files[base + "/aliases.ts"], errors: [
                { message: /\[HFS_ALIAS_REEXPORT\]/, line: 2 },
                { message: /\[HFS_ALIAS_REEXPORT\]/, line: 3 },
                { message: /\[HFS_ALIAS_REEXPORT\]/, line: 4 },
                { message: /\[HFS_ALIAS_REEXPORT\]/, line: 5 },
            ] }],
        })
    })

    test(`R30 ${edition} FE accepts valid declarations and rejects invalid alias reexports`, t => {
        const base = "apps/web/src/modules/named"
        const files = aliasFiles(base)
        const f = projectFixture({ profile: "fe", edition, files })
        t.after(f.cleanup)
        f.tester.run("alias-reexport", feGraphRules["alias-reexport"], {
            valid: [{ filename: f.at(base + "/index.ts"), code: files[base + "/index.ts"] }],
            invalid: [{ filename: f.at(base + "/aliases.ts"), code: files[base + "/aliases.ts"], errors: [
                { message: /\[HFS_ALIAS_REEXPORT\]/, line: 2 },
                { message: /\[HFS_ALIAS_REEXPORT\]/, line: 3 },
                { message: /\[HFS_ALIAS_REEXPORT\]/, line: 4 },
                { message: /\[HFS_ALIAS_REEXPORT\]/, line: 5 },
            ] }],
        })
    })

    test(`R30 ${edition} BE accepts valid package exports and rejects invalid private subpaths`, t => {
        const files = {
            ...packageFiles("be"),
            "apps/api/src/app.module.ts": "import { Public } from '@fixture/ui/public'\nexport const AppModule = Public\n",
            "apps/api/src/main.ts": "import { ui } from '@fixture/ui'\nimport { Private } from '@fixture/ui/private'\nvoid [ui, Private]\n",
        }
        const f = projectFixture({ edition, files, apps: [{ name: "api", kind: "api" }] })
        t.after(f.cleanup)
        f.tester.run("package-export-bypass", beGraphRules["package-export-bypass"], {
            valid: [{ filename: f.at("apps/api/src/app.module.ts"), code: files["apps/api/src/app.module.ts"] }],
            invalid: [{ filename: f.at("apps/api/src/main.ts"), code: files["apps/api/src/main.ts"], errors: [{ message: /\[ARCH_PACKAGE_EXPORT_BYPASS\]/, line: 2 }] }],
        })
    })

    test(`R30 ${edition} FE accepts valid package exports and rejects invalid private subpaths`, t => {
        const files = {
            ...packageFiles("fe"),
            "apps/web/src/app/page.tsx": "import { Public } from '@fixture/ui/public'\nexport default function Page() { return <p>{Public}</p> }\n",
            "apps/web/src/app/peeking.tsx": "import { ui } from '@fixture/ui'\nimport { Private } from '@fixture/ui/private'\nexport const peeking = [ui, Private]\n",
        }
        const f = projectFixture({ profile: "fe", edition, files })
        t.after(f.cleanup)
        f.tester.run("package-export-bypass", feGraphRules["package-export-bypass"], {
            valid: [{ filename: f.at("apps/web/src/app/page.tsx"), code: files["apps/web/src/app/page.tsx"] }],
            invalid: [{ filename: f.at("apps/web/src/app/peeking.tsx"), code: files["apps/web/src/app/peeking.tsx"], errors: [{ message: /\[ARCH_PACKAGE_EXPORT_BYPASS\]/, line: 2 }] }],
        })
    })
}
