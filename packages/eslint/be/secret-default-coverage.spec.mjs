// proves: BE_SECRET_DEFAULT@lite BE_SECRET_DEFAULT@full
import test from "node:test"
import { noSecretDefault } from "./config-owner.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, BE_DECLARATION, TYPED_ROOT, typedTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"

const tester = typedTester()
const filename = at("src/modules/domain/plan/plan.config.ts")
const source = 'import { EnvSource } from "@modules/platform/config"; declare const env: EnvSource;\n'

for (const edition of ["lite", "full"]) {
    test(`R44 ${edition}: required secret readers pass and defaults are refused`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        const settings = { starci: { hfs } }
        tester.run("no-secret-default", noSecretDefault, {
            valid: [{ filename, settings, code: source + 'export const key = env.secret("SERVICE_KEY")' }],
            invalid: [{ filename, settings, code: source + 'export const key = env.secret("SERVICE_KEY", "fallback")', errors: [{ messageId: "argument" }] }],
        })
    })
}
