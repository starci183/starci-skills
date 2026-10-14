// proves: BE_JWT_ALG_PINNED@lite BE_JWT_ALG_PINNED@full
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { jwtAlgPinned, recommended, rules } from "./jwt-alg.mjs"

const SRC = at("src/modules/integrations/supabase/supabase.jwks.ts")
const verifier = ({ algorithms = "['ES256']", issuer = "options.url", guard = "if (payload.role !== 'authenticated') throw new Error('invalid role')", importLine = "import {jwtVerify} from 'jose'", call = "jwtVerify", before = "" } = {}) => `
${importLine}
interface ProviderOptions { url: string }
const keys = {}
${before}
export async function verify(token: string, options: ProviderOptions) {
  const {payload} = await ${call}(token, keys, {issuer: ${issuer}, audience: 'authenticated', algorithms: ${algorithms}})
  ${guard}
  return {id: payload.sub, role: payload.role}
}`

test("R260 BE_JWT_ALG_PINNED exports the registered rule at error", () => {
    assert.equal(rules["jwt-alg-pinned"], jwtAlgPinned)
    assert.equal(recommended["starci-be/jwt-alg-pinned"], "error")
})

for (const edition of ["lite", "full"]) {
    test(`R260 BE_JWT_ALG_PINNED accepts literal secure algorithms and rejects unsigned/shared-secret verification (${edition})`, () => {
        const declaration = appDeclaration("be", { apps: [{ name: "api", kind: "api" }] })
        declaration.edition = edition
        const settings = { starci: { hfs: hfsFromDeclaration(declaration, at("")) } }
        typedTester().run("jwt-alg-pinned", jwtAlgPinned, {
            valid: [
                { filename: SRC, settings, code: verifier() },
                { filename: SRC, settings, code: verifier({ algorithms: "['RS256', 'EdDSA']" }) },
                { filename: SRC, settings, code: verifier({ issuer: "`${options.url.replace(/\\/$/, '')}/auth/v1`" }) },
                { filename: SRC, settings, code: verifier({ importLine: "import {jwtVerify as check} from 'jose'", call: "check" }) },
                { filename: SRC, settings, code: verifier({ importLine: "import * as jose from 'jose'", call: "jose.jwtVerify" }) },
                { filename: SRC, settings, code: verifier({ guard: "if (payload.role !== 'authenticated') return null" }) },
                { filename: SRC, settings, code: verifier({ guard: "if (!payload.sub) return null; if (payload.role !== 'authenticated') throw new Error('invalid')" }) },
                { filename: SRC, settings, code: verifier({ guard: "if (payload.role === 'authenticated') { console.log('valid') } else throw new Error('invalid')" }) },
                { filename: SRC, settings, code: "const jwtVerify = (a: string) => a; jwtVerify('local')" },
            ],
            invalid: [
                ...["['none']", "['HS256']", "['ES256', 'HS256']", "[]", "algorithms", "['ES256', ...extra]"].map(algorithms => ({
                    filename: SRC, settings, code: verifier({ algorithms }), errors: [{ message: /BE_JWT_ALG_PINNED: algorithms/ }],
                })),
                { filename: SRC, settings, code: verifier({ issuer: "'https://literal.invalid/auth/v1'" }), errors: [{ message: /issuer must derive/ }] },
                { filename: SRC, settings, code: verifier({ guard: "" }), errors: [{ message: /reject every role/ }] },
                { filename: SRC, settings, code: verifier({ guard: "if (payload.role === 'service_role') throw new Error('invalid')" }), errors: [{ message: /reject every role/ }] },
                { filename: SRC, settings, code: verifier({ guard: "if (payload.role !== 'authenticated') { console.log('rejected') }" }), errors: [{ message: /reject every role/ }] },
                { filename: SRC, settings, code: verifier({ guard: "return {id: payload.sub}; if (payload.role !== 'authenticated') throw new Error('late')" }), errors: [{ message: /reject every role/ }] },
                { filename: SRC, settings, code: verifier({ guard: "if (payload.role !== 'authenticated' && enabled) throw new Error('partial')" }), errors: [{ message: /reject every role/ }] },
                { filename: SRC, settings, code: verifier({ guard: "if (other.role !== 'authenticated') throw new Error('unrelated')" }), errors: [{ message: /reject every role/ }] },
                { filename: SRC, settings, code: verifier({ guard: "if (payload.role === 'service_role') return {id: payload.sub}; if (payload.role !== 'authenticated') throw new Error('late')" }), errors: [{ message: /reject every role/ }] },
                { filename: SRC, settings, code: verifier({ guard: "if (payload.role !== 'authenticated') { return {id: payload.sub}; throw new Error('unreachable') }" }), errors: [{ message: /reject every role/ }] },
            ],
        })
    })
}
