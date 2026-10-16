// proves: FE_APP_ISOLATION@lite
// proves: FE_APP_ISOLATION@full
import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const APPS = [{ name: "web", kind: "next" }, { name: "admin", kind: "next" }]
const WEB = "apps/web/src/features/pages/"
const ADMIN = "apps/admin/src/modules/shared/index.ts"
const LOCAL = "apps/web/src/modules/shared/index.ts"
const CROSS_APP = "../../../../../admin/src/modules/shared"
const FILES = {
    [ADMIN]: "export const shared = 1\nexport type Shared = number\n",
    [LOCAL]: "export const shared = 2\nexport type Shared = number\n",
    [`${WEB}Local/index.tsx`]: "import { shared } from '../../../modules/shared'\nexport const Local = shared\n",
    [`${WEB}Static/index.tsx`]: `import { shared } from '${CROSS_APP}'\nexport const Static = shared\n`,
    [`${WEB}Typed/index.tsx`]: `import type { Shared } from '${CROSS_APP}'\nexport type Typed = Shared\n`,
    [`${WEB}Reexport/index.tsx`]: `export { shared } from '${CROSS_APP}'\n`,
    [`${WEB}Dynamic/index.tsx`]: `export const loadAdmin = () => import('${CROSS_APP}')\n`,
}

for (const edition of ["lite", "full"]) {
    test(`FE_APP_ISOLATION ${edition}: invalid cross-app imports and valid same-app imports`, (t) => {
        const fixture = projectFixture({ profile: "fe", edition, apps: APPS, files: FILES })
        t.after(fixture.cleanup)
        const at = (rel) => ({ filename: fixture.at(rel), code: FILES[rel] })
        const invalid = (name) => ({
            ...at(`${WEB}${name}/index.tsx`),
            errors: [{ message: /\[FE_APP_ISOLATION\].*app web imports app admin/, line: 1 }],
        })
        fixture.tester.run("app-isolation", rules["app-isolation"], {
            valid: [at(`${WEB}Local/index.tsx`), at(LOCAL), at(ADMIN)],
            invalid: [invalid("Static"), invalid("Typed"), invalid("Reexport"), invalid("Dynamic")],
        })
    })
}
