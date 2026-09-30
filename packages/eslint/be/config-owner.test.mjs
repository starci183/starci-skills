/**
 * Twin tests for the config rules (R43, R44) and the timing-safe secret comparison (R41).
 *
 *   node --test config-owner.test.mjs
 *
 * `Secret`, `Url` and `EnvSource` are declared by the fixture repository's `src/modules/platform/config`, so the owner of
 * a value's type is judged by the slot view.
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noDirectEnvRead, noSecretDefault, secretCompareTimingSafe } from "./config-owner.mjs"

const tester = typedTester()
const SERVICE = at("src/modules/domain/plan/plan.service.ts")
const CONFIG = at("src/modules/domain/plan/plan.config.ts")
const ENV_SOURCE = at("src/modules/platform/config/env-source.ts")
const MAIN = at("apps/api/src/main.ts")

test("the process environment is read only by the file that declares EnvSource in platform/config", () => {
    tester.run("no-direct-env-read", noDirectEnvRead, {
        valid: [
            { filename: ENV_SOURCE, code: "export class EnvSource { static fromProcess() { return { ...process.env } } }" },
            { filename: ENV_SOURCE, code: "export class EnvSource { static a() { return process['env'] } }" },
            { filename: ENV_SOURCE, code: "export class EnvSource { static a() { const { env } = process; return env } }" },
            { filename: SERVICE, code: "const port = options.port" },
            { filename: SERVICE, code: "const env = { region: 1 }; const x = env.region" },
            { filename: SERVICE, code: "const p = path.join(root, 'src')" },
            // a different process object is not the process
            { filename: SERVICE, code: "const process = { env: { X: 1 } }; export const x = process.env" },
        ],
        invalid: [
            { filename: SERVICE, code: "const url = process.env.PLAN_URL", errors: [{ messageId: "env" }] },
            { filename: CONFIG, code: "const env = process.env", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "const x = process['env']", errors: [{ messageId: "env" }] },
            { filename: MAIN, code: "const x = process.env.PORT", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "const { env } = process", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "const { env: e, argv } = process", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "const e = Reflect.get(process, 'env')", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "const e = globalThis.process.env", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "import { env } from 'node:process'\nexport const x = env", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "import proc from 'node:process'\nexport const x = proc.env", errors: [{ messageId: "env" }] },
            // a file in platform/config that does not declare EnvSource is not the reader
            { filename: at("src/modules/platform/config/other.config.ts"), code: "export const read = () => process.env", errors: [{ messageId: "env" }] },
            // a file that declares a class named EnvSource outside platform/config is not the reader either
            { filename: SERVICE, code: "export class EnvSource { read() { return process.env } }", errors: [{ messageId: "env" }] },
            // a spec is not exempt
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: "process.env.X = '1'", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: "import { ConfigService } from '@nestjs/config'\nexport const x = ConfigService", errors: [{ messageId: "package" }] },
            { filename: SERVICE, code: "import 'dotenv/config'", errors: [{ messageId: "package" }] },
            { filename: SERVICE, code: "import dotenv from 'dotenv'\nexport const x = dotenv", errors: [{ messageId: "package" }] },
            { filename: SERVICE, code: "const d = require('dotenv')", errors: [{ messageId: "package" }] },
            { filename: SERVICE, code: "const c = envConfig()", errors: [{ messageId: "envConfig" }] },
            { filename: SERVICE, code: "const p = path.join(process.cwd(), 'src', 'x')", errors: [{ messageId: "cwdPath" }] },
            { filename: SERVICE, code: "const p = path.resolve(process.cwd(), '.starcistacks/dev')", errors: [{ messageId: "cwdPath" }] },
        ],
    })
})

const CFG = "import { EnvSource, Secret } from '@modules/platform/config'\nimport type { Url } from '@modules/platform/config'\ndeclare const env: EnvSource\ndeclare const renamed: EnvSource\ndeclare const secret: Secret\ndeclare const maybeSecret: Secret | undefined\ndeclare const url: Url\ndeclare const maybeUrl: Url | undefined\ndeclare function read(key: string, fallback?: string): Url\ndeclare function readSecret(key: string, fallback?: string): Secret\ndeclare function readText(key: string, fallback?: string): string\n"

test("a value typed Secret or Url has no default, argument or fallback", () => {
    tester.run("no-secret-default", noSecretDefault, {
        valid: [
            { filename: CONFIG, code: `${CFG}const a = env.secret('PLAN_API_KEY')` },
            { filename: CONFIG, code: `${CFG}const a = env.url('PLAN_URL')` },
            // a tunable may have a literal default
            { filename: CONFIG, code: `${CFG}const a = env.int('PLAN_TIMEOUT', 30)` },
            { filename: CONFIG, code: `${CFG}const a = env.optional('PLAN_NAME') ?? 'plan'` },
            // a fallback on a plain string is not a Secret or Url fallback: the type decides, not the name
            { filename: CONFIG, code: `${CFG}const password = readText('POSTGRES_PASSWORD') ?? 'x'` },
            { filename: CONFIG, code: `${CFG}const a = readText('PLAN_URL', 'http://localhost')` },
            { filename: CONFIG, code: `${CFG}const a = read('PLAN_URL')` },
            { filename: CONFIG, code: "const options = { password: '' , token: 'abc', databaseUrl: 'postgres://u@localhost/db' }" },
            { filename: CONFIG, code: `${CFG}const a = readSecret('X', 'not-a-default-literal')` },
        ],
        invalid: [
            { filename: CONFIG, code: `${CFG}const a = env.secret('PLAN_API_KEY', 'dev')`, errors: [{ messageId: "argument" }] },
            { filename: CONFIG, code: `${CFG}const a = env.url('PLAN_URL', 'http://localhost:3000')`, errors: [{ messageId: "argument" }] },
            { filename: CONFIG, code: `${CFG}const a = env.host('PLAN_HOST', 'localhost')`, errors: [{ messageId: "argument" }] },
            // a renamed receiver is still the EnvSource
            { filename: CONFIG, code: `${CFG}const a = renamed.secret('K', 'dev')`, errors: [{ messageId: "argument" }] },
            { filename: CONFIG, code: `${CFG}const a = secret ?? new Secret('dev')`, errors: [{ messageId: "fallback" }] },
            { filename: CONFIG, code: `${CFG}const a = maybeSecret || new Secret('dev')`, errors: [{ messageId: "fallback" }] },
            { filename: CONFIG, code: `${CFG}const a = url ?? 'http://localhost:6379'`, errors: [{ messageId: "fallback" }] },
            { filename: CONFIG, code: `${CFG}const a = maybeUrl || ''`, errors: [{ messageId: "fallback" }] },
            { filename: CONFIG, code: `${CFG}let a = maybeUrl\na ??= 'https://example.com'`, errors: [{ messageId: "fallback" }] },
            // any reader that returns a Secret or Url given a default literal, whatever its name
            { filename: CONFIG, code: `${CFG}const a = read('PLAN_URL', 'localhost')`, errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: `${CFG}const a = read('PLAN_URL', '127.0.0.1')`, errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: `${CFG}const a = read('PLAN_URL', '0.0.0.0')`, errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: `${CFG}const a = read('PLAN_URL', 'https://plan.example')`, errors: [{ messageId: "literal" }] },
            { filename: CONFIG, code: `${CFG}const a = readSecret('PLAN_KEY', '')`, errors: [{ messageId: "literal" }] },
            // a spec is not exempt
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: `${CFG}const a = env.secret('K', 'x')`, errors: [{ messageId: "argument" }] },
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
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: "if (token === expected) {}", errors: [{ messageId: "compare" }] },
        ],
    })
})
