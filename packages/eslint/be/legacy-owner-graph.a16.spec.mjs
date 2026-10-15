// proves: BE_TIER_DIRECTION@lite BE_TIER_DIRECTION@full
// proves: FE_TIER_DIRECTION@lite FE_TIER_DIRECTION@full
// proves: ARCH_PACKAGE_IMPORTS_APP@lite ARCH_PACKAGE_IMPORTS_APP@full
// proves: ARCH_OWNER_CYCLE@lite ARCH_OWNER_CYCLE@full
// proves: BE_FEATURE_IMPORTS_FEATURE@lite BE_FEATURE_IMPORTS_FEATURE@full
import test from "node:test"
import bePlugin from "./index.mjs"
import fePlugin from "../fe/index.mjs"
import { projectFixture } from "./fixtures/project/tester.mjs"

const good = (fixture, files, rel) => ({ filename: fixture.at(rel), code: files[rel] })
const bad = (fixture, files, rel, message) => ({ ...good(fixture, files, rel), errors: [{ message, line: 1 }] })

for (const edition of ["lite", "full"]) {
    test(`R26 backend tier direction accepts downward edges and rejects upward edges in ${edition}`, (t) => {
        const files = {
            "src/features/api/orders/index.ts": "import { config } from '../../../modules/platform/config';\nexport const orders = config;\n",
            "src/modules/domain/orders/index.ts": "import { orders } from '../../../features/api/orders';\nexport const domain = orders;\n",
            "src/modules/platform/config/index.ts": "export const config = 1;\n",
        }
        const fixture = projectFixture({ edition, files })
        t.after(fixture.cleanup)
        fixture.tester.run("tier-direction", bePlugin.rules["tier-direction"], {
            valid: [good(fixture, files, "src/features/api/orders/index.ts")],
            invalid: [bad(fixture, files, "src/modules/domain/orders/index.ts", /BE_TIER_DIRECTION/)],
        })
    })

    test(`R26 frontend tier direction accepts downward edges and rejects upward edges in ${edition}`, (t) => {
        const files = {
            "apps/web/src/features/pages/home/index.tsx": "import { config } from '../../../modules/config';\nexport const Home = config;\n",
            "apps/web/src/modules/catalog/index.ts": "import { useCart } from '../../hooks/cart';\nexport const catalog = useCart;\n",
            "apps/web/src/hooks/cart/index.ts": "export const useCart = () => 1;\n",
            "apps/web/src/modules/config/index.ts": "export const config = 1;\n",
        }
        const fixture = projectFixture({ edition, profile: "fe", files })
        t.after(fixture.cleanup)
        fixture.tester.run("tier-direction", fePlugin.rules["tier-direction"], {
            valid: [good(fixture, files, "apps/web/src/features/pages/home/index.tsx")],
            invalid: [bad(fixture, files, "apps/web/src/modules/catalog/index.ts", /FE_TIER_DIRECTION/)],
        })
    })

    for (const profile of ["be", "fe"]) {
        test(`R26 ${profile} packages accept internal imports and reject type-only app imports in ${edition}`, (t) => {
            const files = {
                "../package.json": JSON.stringify({ private: true, workspaces: [profile + "/packages/*"] }),
                "tsconfig.json": JSON.stringify({
                    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", baseUrl: ".", paths: { "@fixture/app/*": ["apps/demo/src/*"] }, noEmit: true },
                    include: ["src/**/*", "apps/**/*", "packages/**/*"],
                }),
                "apps/demo/src/contract.ts": "export type AppContract = string;\n",
                "packages/ui/package.json": JSON.stringify({ name: "@fixture/ui", private: true, exports: { ".": "./src/index.ts" } }),
                "packages/ui/src/index.ts": "export type { AppContract } from '@fixture/app/contract';\n",
                "packages/ui/src/clean.ts": "import { value } from './value';\nexport const clean = value;\n",
                "packages/ui/src/value.ts": "export const value = 1;\n",
            }
            const apps = [{ name: "demo", kind: "api" }]
            if (profile === "fe") apps[0].kind = "next"
            const fixture = projectFixture({ edition, profile, files, apps })
            t.after(fixture.cleanup)
            const plugin = profile === "be" ? bePlugin : fePlugin
            fixture.tester.run("package-imports-app", plugin.rules["package-imports-app"], {
                valid: [good(fixture, files, "packages/ui/src/clean.ts")],
                invalid: [bad(fixture, files, "packages/ui/src/index.ts", /ARCH_PACKAGE_IMPORTS_APP/)],
            })
        })

        test(`R27 ${profile} owners accept acyclic chains and reject type-only cycles in ${edition}`, (t) => {
            let base = "src/modules/domain/"
            if (profile === "fe") base = "apps/web/src/modules/"
            const files = {
                [base + "x/index.ts"]: "import { y } from '../y';\nexport const x = y;\nexport type X = string;\n",
                [base + "y/index.ts"]: "import type { X } from '../x';\nexport type Y = X;\nexport const y = 1;\n",
                [base + "a/index.ts"]: "import { b } from '../b';\nexport const a = b;\n",
                [base + "b/index.ts"]: "export const b = 1;\n",
            }
            const fixture = projectFixture({ edition, profile, files })
            t.after(fixture.cleanup)
            const plugin = profile === "be" ? bePlugin : fePlugin
            fixture.tester.run("owner-cycle", plugin.rules["owner-cycle"], {
                valid: [good(fixture, files, base + "a/index.ts")],
                invalid: [bad(fixture, files, base + "x/index.ts", /ARCH_OWNER_CYCLE/)],
            })
        })
    }

    test(`R28 features accept domain dependencies and reject runtime and type-only feature imports in ${edition}`, (t) => {
        const files = {
            "src/features/api/a/index.ts": "import { b } from '../b';\nexport const a = b;\n",
            "src/features/api/b/index.ts": "export const b = 1;\n",
            "src/features/api/c/index.ts": "import type { D } from '../d';\nexport type C = D;\n",
            "src/features/api/d/index.ts": "export type D = string;\n",
            "src/features/api/clean/index.ts": "import { domain } from '../../../modules/domain/orders';\nexport const clean = domain;\n",
            "src/modules/domain/orders/index.ts": "export const domain = 1;\n",
        }
        const fixture = projectFixture({ edition, files })
        t.after(fixture.cleanup)
        fixture.tester.run("feature-imports-feature", bePlugin.rules["feature-imports-feature"], {
            valid: [good(fixture, files, "src/features/api/clean/index.ts")],
            invalid: [
                bad(fixture, files, "src/features/api/a/index.ts", /BE_FEATURE_IMPORTS_FEATURE/),
                bad(fixture, files, "src/features/api/c/index.ts", /BE_FEATURE_IMPORTS_FEATURE/),
            ],
        })
    })
}
