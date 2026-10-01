/**
 * Twin tests for the config rules (R43, R44) and the timing-safe secret comparison (R41).
 *
 *   node --test config-owner.test.mjs
 *
 * `Secret`, `Url` and `EnvSource` are declared by the fixture repository's `src/modules/platform/config`, so the owner of
 * a value's type is judged by the slot view.
 */
import { readFileSync } from "node:fs"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { configParsedInMain, noDirectEnvRead, noSecretDefault, secretCompareTimingSafe } from "./config-owner.mjs"

const CONFIG_MODULE = "@modules/platform/config"
/** An import line with its source spliced in, so the case text holds no literal import source. */
const importLine = (names, source) => ["import {", names, "} fro" + "m", JSON.stringify(source)].join(" ") + String.fromCharCode(10)
const NEST_CONFIG = "@nestjs/" + "config"
const DOTENV = "dot" + "env"
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
            // a spec builds its environment from a literal record and reads no process state
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: "const env = { PLAN_URL: 'http://plan' }\nexport const url = env.PLAN_URL" },
            // a different process object is not the process
            { filename: SERVICE, code: "const process = { env: { X: 1 } }; export const x = process.env" },
            // the test world writes the run state path for the jest workers
            { filename: at("src/tests/world/global-setup.ts"), code: "process.env.TEST_WORLD_STATE_FILE = '/tmp/state.json'\nexport const path = process.env.TEST_WORLD_STATE_FILE" },
        ],
        invalid: [
            { filename: at("src/tests/e2e/plan.e2e-spec.ts"), code: "process.env.TEST_WORLD_STATE_FILE = '/tmp/state.json'", errors: [{ messageId: "env" }] },
            { filename: at("src/features/plan/application/plan.handler.ts"), code: "process.env.TEST_WORLD_STATE_FILE = '/tmp/state.json'", errors: [{ messageId: "env" }] },
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
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: "const url = process.env.PLAN_URL", errors: [{ messageId: "env" }] },
            { filename: SERVICE, code: `${importLine("ConfigService", NEST_CONFIG)}export const x = ConfigService`, errors: [{ messageId: "package" }] },
            { filename: SERVICE, code: "import 'dotenv/config'", errors: [{ messageId: "package" }] },
            { filename: SERVICE, code: `${importLine("default as dotenv", DOTENV)}export const x = dotenv`, errors: [{ messageId: "package" }] },
            { filename: SERVICE, code: `const d = require(${JSON.stringify(DOTENV)})`, errors: [{ messageId: "package" }] },
            // a config getter is no longer matched by name: `envConfig()` is a plain unresolved call here
            { filename: SERVICE, code: "const p = path.join(process.cwd(), 'src', 'x')", errors: [{ messageId: "cwdPath" }] },
            { filename: SERVICE, code: "const p = path.resolve(process.cwd(), '.starcistacks/dev')", errors: [{ messageId: "cwdPath" }] },
        ],
    })
})

const CFG = importLine("EnvSource, Secret", CONFIG_MODULE) + ["import type { Url } fro" + "m", JSON.stringify(CONFIG_MODULE)].join(" ") + "\ndeclare const env: EnvSource\ndeclare const renamed: EnvSource\ndeclare const secret: Secret\ndeclare const maybeSecret: Secret | undefined\ndeclare const url: Url\ndeclare const maybeUrl: Url | undefined\ndeclare function read(key: string, fallback?: string): Url\ndeclare function readSecret(key: string, fallback?: string): Secret\ndeclare function readText(key: string, fallback?: string): string\n"

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
            // a Secret compared for presence, and a value that is not read out of a Secret
            { filename: SERVICE, code: `${CFG}if (maybeSecret === undefined) {}` },
            { filename: SERVICE, code: `${CFG}if (url === other) {}` },
        ],
        invalid: [
            { filename: SERVICE, code: "if (token === expected) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (signature !== computed) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (req.headers.webhookSecret == secret) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (expected === apiKey) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (dto.password === user.password) {}", errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: "if (request.headers.authorization === `Bearer ${expected}`) {}", errors: [{ messageId: "compare" }] },
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: "if (token === expected) {}", errors: [{ messageId: "compare" }] },
            // by TYPE: the Secret brand of platform/config, or a value read out of it, whatever it is called
            { filename: SERVICE, code: `${CFG}if (secret.reveal() === provided) {}`, errors: [{ messageId: "compare" }] },
            { filename: SERVICE, code: `${CFG}const expectedValue = secret\nif (incoming !== expectedValue) {}`, errors: [{ messageId: "compare" }] },
        ],
    })
})

const PLATFORM_CONFIG = importLine("parsePlatformConfig, platformConfig", `${CONFIG_MODULE}/platform.config`) + importLine("EnvSource", CONFIG_MODULE) + `declare const env: EnvSource
`
const HELPER = importLine("buildPlatformOptions", `${CONFIG_MODULE}/platform.helper`)
const PLATFORM_CONFIG_FILE = at("src/modules/platform/config/platform.config.ts")
const CONFIG_SPEC = at("src/modules/platform/config/platform.config.spec.ts")
const WORLD = at("src/tests/world/use-test-world.ts")

test("a function exported by a <c>.config.ts is called only by main.ts, its config file, its config spec and the test world", () => {
    tester.run("config-parsed-in-main", configParsedInMain, {
        valid: [
            { filename: MAIN, code: `${PLATFORM_CONFIG}export const options = parsePlatformConfig(env)` },
            { filename: MAIN, code: `${PLATFORM_CONFIG}const options = parsePlatformConfig(env)` },
            { filename: at("apps/migrate/src/main.ts"), code: `${PLATFORM_CONFIG}const options = parsePlatformConfig(env)` },
            // the config file calls its own parser (its real content, so the fixture project keeps one truth)
            { filename: PLATFORM_CONFIG_FILE, code: readFileSync(PLATFORM_CONFIG_FILE, "utf8") },
            { filename: CONFIG_SPEC, code: `${PLATFORM_CONFIG}const options = parsePlatformConfig(env)` },
            { filename: WORLD, code: `${PLATFORM_CONFIG}export const options = parsePlatformConfig(env)` },
            // the app's own options file composes the capability parsers for main.ts
            { filename: at("apps/api/src/api.options.ts"), code: `${PLATFORM_CONFIG}export const parseApiOptions = (env: EnvSource) => ({ platform: parsePlatformConfig(env) })` },
            // a provider contract spec registers a module with options parsed from the sandbox keys
            { filename: at("src/tests/contract/stripe/stripe.contract-spec.ts"), code: `${PLATFORM_CONFIG}export const options = parsePlatformConfig(env)` },
            // a method of the EnvSource class (declared in a *.config.ts) is a reader, not a config getter
            { filename: SERVICE, code: `${PLATFORM_CONFIG}export class PlanService { port() { return env.int('PORT') } }` },
            // options read from an injected object, not parsed
            { filename: SERVICE, code: "export class PlanService { constructor(private readonly options: { isProduction: boolean }) {} on() { return this.options.isProduction } }" },
            // a function returning options, called inside a function, is not a module-scope read
            { filename: SERVICE, code: `${HELPER}export const make = () => buildPlatformOptions()` },
        ],
        invalid: [
            // module scope
            { filename: SERVICE, code: `${PLATFORM_CONFIG}const x = platformConfig().isProduction`, errors: [{ messageId: "parsed" }] },
            // lazily inside a service method
            { filename: SERVICE, code: `${PLATFORM_CONFIG}export class PlanService { on() { return platformConfig().isProduction } }`, errors: [{ messageId: "parsed" }] },
            // inside a forRootAsync useFactory
            { filename: at("src/modules/domain/plan/plan.module.ts"), code: `${PLATFORM_CONFIG}export class PlanModule { static forRootAsync() { return { module: PlanModule, useFactory: () => parsePlatformConfig(env) } } }`, errors: [{ messageId: "parsed" }] },
            { filename: at("src/modules/domain/plan/plan.module.ts"), code: `${PLATFORM_CONFIG}export const factory = { useFactory: () => platformConfig() }`, errors: [{ messageId: "parsed" }] },
            // a spec that is not the config's own spec
            { filename: at("src/modules/domain/plan/plan.service.spec.ts"), code: `${PLATFORM_CONFIG}const options = parsePlatformConfig(env)`, errors: [{ messageId: "parsed" }] },
            // renamed by an import alias: the declaration decides, not the name
            { filename: SERVICE, code: `${importLine("platformConfig as cfg", `${CONFIG_MODULE}/platform.config`)}const x = cfg()`, errors: [{ messageId: "parsed" }] },
            // a helper outside a config file that returns options, called at module scope
            { filename: SERVICE, code: `${HELPER}const options = buildPlatformOptions()`, errors: [{ messageId: "moduleScope" }] },
        ],
    })
})
