// proves: BE_CORS_ALLOWLIST@lite BE_CORS_ALLOWLIST@full BE_SECURITY_HEADERS@lite BE_SECURITY_HEADERS@full BE_TRUST_PROXY@lite BE_TRUST_PROXY@full
import assert from "node:assert/strict"
import test from "node:test"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, TYPED_ROOT } from "./fixtures/typed/tester.mjs"
import { corsAllowlist, securityHeaders, trustProxy, recommended, rules } from "./edge-hardening.mjs"
import plugin, { lawOwners, ruleDeclarations, ruleOwners, recommended as pluginRecommended } from "./index.mjs"

const MAIN = at("apps/api/src/main.ts")
const HEAD = 'import { NestFactory } from "@nestjs/core"; const app = await NestFactory.create(AppModule);\n'
const DIRECT = `${HEAD}import { securityHeaders } from "@modules/platform/http-security/edge-security.service";
app.enableCors({ origin: ["https://app.example.test"] });
app.use(securityHeaders);
const express = app.getHttpAdapter().getInstance();
express.disable("x-powered-by"); express.set("trust proxy", 1);`
const HELPER = `${HEAD}import { applyHttpSecurity as applyEdge } from "@modules/platform/http-security/edge-security.service";
applyEdge(app, options.httpSecurity, { trustProxy: 1 });`

const tester = (edition) => {
    const declaration = { ...appDeclaration("be", { apps: [{ name: "api", kind: "api" }, { name: "cli", kind: "cli" }] }), edition }
    return new RuleTester({
        languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
        settings: { starci: { hfs: hfsFromDeclaration(declaration, TYPED_ROOT) } },
    })
}
const entry = (code) => ({ filename: MAIN, code })
const refusal = (code) => ({ ...entry(code), errors: [{ messageId: "boundary" }] })

for (const edition of ["lite", "full"]) {
    test(`BE_CORS_ALLOWLIST ${edition}: explicit config or exact literal origins pass; wildcard, open and missing CORS fail`, () => {
        tester(edition).run("cors-allowlist", corsAllowlist, {
            valid: [
                entry(DIRECT), entry(HELPER),
                entry(`${HEAD}app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })`),
                entry(`${HEAD}const origins = ["https://app.example.test"] as const; app.enableCors({ origin: origins })`),
                { filename: at("apps/cli/src/main.ts"), code: "export const worker = 1" },
            ],
            invalid: [
                refusal(HEAD), refusal(`${HEAD}app.enableCors("*")`), refusal(`${HEAD}app.enableCors()`),
                refusal(`${HEAD}app.enableCors({origin: "*"})`), refusal(`${HEAD}app.enableCors({origin: true})`),
                refusal(`${HEAD}app.enableCors({origin: ["https://*.example.test"]})`), refusal(`${HEAD}app.enableCors({origin: []})`),
                refusal(`${HEAD}app.enableCors({origin: ["https://app.example.test/"]})`), refusal(`${HEAD}app.enableCors({origin: ["http://app.example.test"]})`),
                refusal(`${HEAD}const origins = ["*"]; app.enableCors({origin: origins})`),
                refusal(`${HEAD}const bad = {allowedOrigins: ["*"]}; app.enableCors({origin: bad.allowedOrigins})`),
                refusal(`${HEAD}const enableCors = "other"; app[enableCors]({origin: ["https://app.example.test"]})`),
                refusal(`${HEAD}const origin = "other"; app.enableCors({[origin]: ["https://app.example.test"]})`),
                refusal(`${HEAD}app.enableCors({origin: ["https://app.example.test"], origin: ["*"]})`),
                refusal(`${HEAD}app.enableCors({origin: ["https://app.example.test"], ...dynamic})`),
                refusal(`${HELPER}\napp.enableCors({origin: "*"})`),
                refusal(`${HEAD}function applyHttpSecurity() {} applyHttpSecurity(app, options.httpSecurity, {trustProxy: 1})`),
                refusal(`${HEAD}const other = { enableCors() {} }; other.enableCors({origin: ["https://app.example.test"]})`),
            ],
        })
    })
    test(`BE_SECURITY_HEADERS ${edition}: platform middleware and powered-by disabled pass; missing or re-enabled headers fail`, () => {
        tester(edition).run("security-headers", securityHeaders, {
            valid: [entry(DIRECT), entry(HELPER)],
            invalid: [
                refusal(HEAD),
                refusal(`${HEAD}app.getHttpAdapter().getInstance().disable("x-powered-by")`),
                refusal(DIRECT.replace('express.disable("x-powered-by");', "")),
                refusal(`${DIRECT}\nexpress.enable("x-powered-by")`),
                refusal(`${HELPER}\napp.getHttpAdapter().getInstance().set("x-powered-by", true)`),
                refusal(DIRECT.replace('"@modules/platform/http-security/edge-security.service"', '"./unowned-middleware"')),
            ],
        })
    })
    test(`BE_TRUST_PROXY ${edition}: declared bounded hop count passes; missing, blanket and dynamic proxy trust fail`, () => {
        tester(edition).run("trust-proxy", trustProxy, {
            valid: [entry(DIRECT), entry(HELPER), entry(`${HEAD}app.getHttpAdapter().getInstance().set("trust proxy", 0)`)],
            invalid: [
                refusal(HEAD), refusal(DIRECT.replace('"trust proxy", 1', '"trust proxy", true')),
                refusal(DIRECT.replace('"trust proxy", 1', '"trust proxy", -1')),
                refusal(DIRECT.replace('"trust proxy", 1', '"trust proxy", 1.5')),
                refusal(DIRECT.replace('"trust proxy", 1', '"trust proxy", options.proxy')),
                refusal(HELPER.replace('{ trustProxy: 1 }', '{}')),
                refusal(HELPER.replace('{ trustProxy: 1 }', '{ trustProxy: 1, trustProxy: true }')),
                refusal(HELPER.replace('{ trustProxy: 1 }', '{ trustProxy: 1, ...dynamic }')),
                refusal(`${HELPER}\napp.getHttpAdapter().getInstance().set("trust proxy", true)`),
            ],
        })
    })
}

test("R261 publishes each rule at error", () => {
    assert.deepEqual(Object.keys(rules), ["cors-allowlist", "security-headers", "trust-proxy"])
    assert.deepEqual(Object.values(recommended), ["error", "error", "error"])
    for (const [id, rule] of Object.entries(rules)) {
        assert.equal(plugin.rules[id], rule)
        assert.equal(pluginRecommended[`starci-be/${id}`], "error")
        assert.equal(ruleOwners[id], "edge-hardening")
        assert.deepEqual(ruleDeclarations.filter((entry) => entry.name === id), [{ law: "edge-hardening", name: id }])
    }
    assert.ok(lawOwners.includes("edge-hardening"))
    assert.ok(plugin.rules["ready-real"])
    assert.ok(plugin.rules["health-signals"])
    assert.ok(plugin.rules["jwt-alg-pinned"])
})
