import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noDirectEnvRead, noSecretDefault, secretCompareTimingSafe } from "./config-owner.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SERVICE = "D:/repo/src/modules/domain/plan/plan.service.ts"
const CONFIG = "D:/repo/src/modules/domain/plan/plan.config.ts"

test("process.env is read only inside platform/config", () => {
    tester.run("no-direct-env-read", noDirectEnvRead, {
        valid: [
            { filename: "D:/repo/src/modules/platform/config/env-source.ts", code: "export const read = () => process.env" },
            { filename: "D:/repo/src/modules/platform/config/env-source.ts", code: "const x = process['env']" },
            { filename: SERVICE, code: "const port = options.port" },
            { filename: "D:/repo/apps/api/src/main.ts", code: "const env = readEnvironment()" },
            // a spec arranges its own environment
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", code: "process.env.X = '1'" },
            { filename: SERVICE, code: "const env = { region: 1 }; const x = env.region" },
        ],
        invalid: [
            { filename: SERVICE, code: "const url = process.env.PLAN_URL", errors: [{ messageId: "env" }] },
            { filename: CONFIG, code: "const env = process.env", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "const x = process['env']", errors: [{ messageId: "env" }] },
            { filename: "D:/repo/apps/api/src/main.ts", code: "const x = process.env.PORT", errors: [{ messageId: "env" }] },
            {
                filename: "D:/repo/src/modules/domain/plan/plan.module.ts",
                code: "const m = { useFactory: () => readEnvironment() }",
                errors: [{ messageId: "factory" }],
            },
        ],
    })
})

test("a secret or URL config value has no literal default", () => {
    tester.run("no-secret-default", noSecretDefault, {
        valid: [
            { filename: CONFIG, code: "const password = env.POSTGRES_PASSWORD" },
            { filename: CONFIG, code: "const schema = z.object({ POSTGRES_PASSWORD: z.string().min(1) })" },
            { filename: CONFIG, code: "const port = env.PORT ?? '3000'" },
            { filename: CONFIG, code: "const o = { tokenType: 'Bearer', password: '' }" },
            { filename: CONFIG, code: "const schema = z.object({ POSTGRES_PORT: z.string().default('5432') })" },
            { filename: CONFIG, code: "const url = new URL(options.redisUrl)" },
            // a spec holds fake credentials
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", code: "const password = 'Nivo123_A'" },
            { filename: SERVICE, code: "const p = path.join(root, 'src')" },
            { filename: SERVICE, code: "const link = { docsUrl: '/docs' }" },
            // an UPPER_SNAKE literal names an environment key; it is not the secret
            { filename: CONFIG, code: "const N8N_API_KEY = 'N8N_API_KEY'" },
            { filename: CONFIG, code: "export const MEDIA_SIGNING_SECRET_KEY = 'mediaSigningSecret'" },
        ],
        invalid: [
            { filename: CONFIG, code: "const password = env.POSTGRES_PASSWORD ?? 'Nivo123_A'", errors: [{ messageId: "fallback" }] },
            { filename: CONFIG, code: "const s = process.env.JWT_SECRET || 'dev-secret'", errors: [{ messageId: "fallback" }] },
            { filename: CONFIG, code: "const token = config.get('API_TOKEN') ?? 'abc'", errors: [{ messageId: "fallback" }] },
            { filename: CONFIG, code: "const url = env.REDIS_URL ?? 'redis://localhost:6379'", errors: [{ messageId: "fallback" }] },
            { filename: CONFIG, code: "const options = { password: 'Nivo123_A' }", errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: "const webhookSecret = 'whsec_abc'", errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: "class C { private readonly apiKey = 'k-123' }", errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: "const o = { databaseUrl: 'postgres://u@localhost/db' }", errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: "function f(secret = 'dev') {}", errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: "const schema = z.object({ POSTGRES_PASSWORD: z.string().default('x') })", errors: [{ messageId: "schemaDefault" }] },
            { filename: CONFIG, code: "const schema = z.object({ REDIS_URL: z.string().default('redis://localhost') })", errors: [{ messageId: "schemaDefault" }] },
            { filename: SERVICE, code: "const p = path.join(process.cwd(), 'src', 'x')", errors: [{ messageId: "cwdPath" }] },
            { filename: SERVICE, code: "const p = path.resolve(process.cwd(), '.starcistacks/dev')", errors: [{ messageId: "cwdPath" }] },
        ],
    })
})

test("a secret is compared with timingSafeEqual, never an equality operator", () => {
    tester.run("secret-compare-timing-safe", secretCompareTimingSafe, {
        valid: [
            { filename: SERVICE, code: "if (timingSafeEqual(a, b)) {}" },
            { filename: SERVICE, code: "if (token === undefined) {}" },
            { filename: SERVICE, code: "if (password !== '') {}" },
            { filename: SERVICE, code: "if (request.token !== null) {}" },
            { filename: SERVICE, code: "if (tokenType === 'bearer') {}" },
            { filename: SERVICE, code: "if (token.length === 0) {}" },
            { filename: SERVICE, code: "if (cacheKey === other) {}" },
            { filename: SERVICE, code: "if (status === expected) {}" },
            // a fencing token is a counter, and an UPPER_SNAKE name is a constant naming a key
            { filename: SERVICE, code: "if (parent.fencingToken !== job.fencingToken) {}" },
            { filename: SERVICE, code: "if (status.key === OPENCLAW_GATEWAY_PASSWORD) {}" },
            // a content digest is an integrity fingerprint, not a secret
            { filename: SERVICE, code: "if (existing.contentDigest === input.contentDigest) {}" },
        ],
        invalid: [
            { filename: SERVICE, code: "if (token === expected) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (signature !== computed) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (req.headers.webhookSecret == secret) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (expected === apiKey) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (dto.password === user.password) {}", errors: [{ messageId: "compare" }] },
            { filename: "D:/repo/src/modules/domain/plan/plan.service.spec.ts", code: "if (token === expected) {}", errors: [{ messageId: "compare" }] },
        ],
    })
})
