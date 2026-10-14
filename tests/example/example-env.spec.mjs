import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import vm from "node:vm"
import { createRequire } from "node:module"

const ROOT = path.resolve(import.meta.dirname, "..", "..")
const ts = createRequire(import.meta.url)("typescript")
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "example-env-"))
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }))

const VALUES = {
    BILLING_API_PORT: "3003",
    IDENTITY_API_PORT: "3001",
    ORDER_API_PORT: "3002",
    PORT: "3000",
    BILLING_DB_URL: "postgresql://billing.invalid/db",
    IDENTITY_DB_URL: "postgresql://identity.invalid/db",
    ORDER_DB_URL: "postgresql://order.invalid/db",
    PRIMARY_DB_URL: "postgresql://primary.invalid/db",
    PRIMARY_DB_SCHEMA: "app",
    IDENTITY_API_URL: "https://identity.invalid",
    ORDER_API_URL: "https://order.invalid",
    CACHE_REDIS_URL: "redis://cache.invalid",
    KEYCLOAK_TOKEN_URL: "https://keycloak.invalid/token",
    KEYCLOAK_CLIENT_ID: "shop",
    KEYCLOAK_ADMIN_URL: "https://keycloak.invalid",
    KEYCLOAK_ADMIN_REALM: "shop",
    KEYCLOAK_ADMIN_CLIENT_ID: "admin",
    KEYCLOAK_ADMIN_CLIENT_SECRET: "test-admin-secret",
    EVENT_BUS_BROKERS: "broker.invalid:9092",
    EVENT_BUS_GROUP_ID: "test-group",
    HTTP_SECURITY_ALLOWED_ORIGINS: "https://shop.invalid",
    SEPAY_WEBHOOK_SECRET: "test-bank-secret",
    CALENDAR_WEBHOOK_SECRET: "test-calendar-secret",
    QUEUE_REDIS_HOST: "queue.invalid",
    RECEIPTS_S3_ENDPOINT: "https://receipts.invalid",
    RECEIPTS_S3_BUCKET: "receipts",
    RECEIPTS_S3_ACCESS_KEY_ID: "test-access-id",
    RECEIPTS_S3_SECRET_ACCESS_KEY: "test-storage-secret",
    SUPABASE_URL: "https://supabase.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-secret",
}

const APPS = [
    ["ecommerce-app", "billing", ["BILLING_API_PORT", "BILLING_DB_URL", "IDENTITY_API_URL", "HTTP_SECURITY_ALLOWED_ORIGINS", "SEPAY_WEBHOOK_SECRET", "EVENT_BUS_BROKERS", "EVENT_BUS_GROUP_ID"], "BILLING_DB_URL", (options) => options.database.url],
    ["ecommerce-app", "identity", ["IDENTITY_API_PORT", "IDENTITY_DB_URL", "CACHE_REDIS_URL", "KEYCLOAK_TOKEN_URL", "KEYCLOAK_CLIENT_ID", "KEYCLOAK_ADMIN_URL", "KEYCLOAK_ADMIN_REALM", "KEYCLOAK_ADMIN_CLIENT_ID", "KEYCLOAK_ADMIN_CLIENT_SECRET", "ORDER_API_URL", "HTTP_SECURITY_ALLOWED_ORIGINS"], "IDENTITY_DB_URL", (options) => options.database.url],
    ["ecommerce-app", "order", ["ORDER_API_PORT", "ORDER_DB_URL", "IDENTITY_API_URL", "EVENT_BUS_BROKERS", "EVENT_BUS_GROUP_ID", "RECEIPTS_S3_ENDPOINT", "RECEIPTS_S3_BUCKET", "RECEIPTS_S3_ACCESS_KEY_ID", "RECEIPTS_S3_SECRET_ACCESS_KEY", "HTTP_SECURITY_ALLOWED_ORIGINS", "QUEUE_REDIS_HOST"], "ORDER_DB_URL", (options) => options.database.url],
    ["ecommerce-app", "cli", ["IDENTITY_DB_URL", "ORDER_DB_URL", "BILLING_DB_URL"], "IDENTITY_DB_URL", (options) => options.identity.url],
    ["lite-app", "api", ["PORT", "HTTP_SECURITY_ALLOWED_ORIGINS", "CALENDAR_WEBHOOK_SECRET", "PRIMARY_DB_URL", "PRIMARY_DB_SCHEMA", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], "PRIMARY_DB_URL", (options) => options.database.url],
    ["lite-app", "cli", ["PRIMARY_DB_URL", "PRIMARY_DB_SCHEMA"], "PRIMARY_DB_URL", (options) => options.url],
    ["shape-slot", "core", ["PORT", "HTTP_SECURITY_ALLOWED_ORIGINS", "PRIMARY_DB_URL"], "PRIMARY_DB_URL", (options) => options.database.url],
    ["shape-slot", "cli", ["PRIMARY_DB_URL"], "PRIMARY_DB_URL", (options) => options.url],
]

/** Execute real readers and their config dependencies; lazy barrel exports avoid booting unrelated Nest modules. */
function loadReader(example, app, values) {
    const be = path.join(ROOT, "examples", example, "be")
    const cache = new Map()
    const resolve = (name, owner) => {
        if (name.startsWith("@modules/")) return path.join(be, "src", "modules", name.slice(9), "index.ts")
        assert.ok(name.startsWith("."), `unexpected reader dependency ${name}`)
        return path.resolve(path.dirname(owner), `${name}.ts`)
    }
    const load = (file) => {
        if (cache.has(file)) return cache.get(file)
        const source = fs.readFileSync(file, "utf8")
        const exports = {}
        cache.set(file, exports)
        if (path.basename(file) === "index.ts") {
            const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
            for (const node of ast.statements) {
                if (!ts.isExportDeclaration(node) || node.isTypeOnly || !node.moduleSpecifier || !node.exportClause || !ts.isNamedExports(node.exportClause)) continue
                for (const item of node.exportClause.elements) {
                    if (item.isTypeOnly) continue
                    Object.defineProperty(exports, item.name.text, { get: () => load(resolve(node.moduleSpecifier.text, file))[item.propertyName?.text ?? item.name.text] })
                }
            }
            return exports
        }
        const compiled = ts.transpileModule(source, {
            fileName: file,
            reportDiagnostics: true,
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        })
        assert.equal(compiled.diagnostics.length, 0, `${file} has valid TypeScript syntax`)
        const require = (name) => name === "node:fs" ? fs : load(resolve(name, file))
        vm.runInNewContext(compiled.outputText, { exports, module: { exports }, require, process: { env: values }, URL }, { filename: file })
        return exports
    }
    const pascal = app[0].toUpperCase() + app.slice(1)
    const read = load(path.join(be, "apps", app, "src", `${app}.env.ts`))[`read${pascal}Env`]
    const { EnvSource } = load(path.join(be, "src", "modules", "platform", "config", "env-source.config.ts"))
    return { read, EnvSource }
}

for (const [example, app, required, secretKey, secretOf] of APPS) {
    const label = `${example}/${app}`
    test(`${label}: parses declared values and fails fast for each missing required key`, () => {
        const { read, EnvSource } = loadReader(example, app, VALUES)
        const options = read(new EnvSource(VALUES))
        assert.equal(secretOf(options).reveal(), VALUES[secretKey])
        assert.equal(JSON.stringify(secretOf(options)), '"[secret]"')
        for (const key of required) {
            const values = { ...VALUES }
            delete values[key]
            assert.throws(() => read(new EnvSource(values)), (error) => error.code === "CONFIG_KEY_MISSING" && error.params.key === key, `${key} cannot use a fallback`)
        }
        for (const key of required.filter((key) => key.endsWith("_PORT") || key === "PORT" || ["IDENTITY_API_URL", "ORDER_API_URL", "KEYCLOAK_TOKEN_URL", "KEYCLOAK_ADMIN_URL", "RECEIPTS_S3_ENDPOINT", "SUPABASE_URL"].includes(key))) {
            assert.throws(() => read(new EnvSource({ ...VALUES, [key]: "invalid" })), (error) => error.code === "CONFIG_KEY_INVALID" && error.params.key === key)
        }
    })

    test(`${label}: reads the mounted secret before the direct value`, () => {
        const file = path.join(TMP_ROOT, `${example}-${app}-secret`)
        const mounted = `postgresql://mounted.invalid/${app}\r\n`
        fs.writeFileSync(file, mounted)
        const { read, EnvSource } = loadReader(example, app, { ...VALUES, [`${secretKey}_FILE`]: file })
        assert.equal(secretOf(read(EnvSource.fromProcess())).reveal(), mounted)
    })

    test(`${label}: owns a typed env reader and keeps composition free of env reads`, () => {
        const base = path.join(ROOT, "examples", example, "be", "apps", app, "src")
        const env = fs.readFileSync(path.join(base, `${app}.env.ts`), "utf8")
        const pascal = app[0].toUpperCase() + app.slice(1)
        const ast = ts.createSourceFile(`${app}.env.ts`, env, ts.ScriptTarget.Latest, true)
        const declaration = ast.statements.find((node) => ts.isInterfaceDeclaration(node) && node.name.text === `${pascal}Env`)
        assert.ok(declaration?.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword), "the env interface is exported")
        assert.match(env, new RegExp(`export const read${pascal}Env = \\(env: EnvSource\\): ${pascal}Env =>`))
        assert.ok(env.trimEnd().split(/\r?\n/).length <= 150)
        assert.doesNotMatch(env, /@modules\/(?:features|projections)\/|Entities|Migrations/)
        const main = fs.readFileSync(path.join(base, "main.ts"), "utf8")
        assert.ok(main.trimEnd().split(/\r?\n/).length <= 80)
        assert.match(main, new RegExp(`import \\{ read${pascal}Env \\} from "\\./${app}\\.env"`))
        assert.match(main, /EnvSource\.fromProcess\(\)/)
        assert.match(main, app === "cli" ? /createCliAppOptions\(readCliEnv\(EnvSource\.fromProcess\(\)\)\)/ : new RegExp(`const options = read${pascal}Env\\(env\\)`))
        const composition = [path.join(base, `${app}.options.ts`)]
        const groups = path.join(base, "compose")
        if (fs.existsSync(groups)) composition.push(...fs.readdirSync(groups).filter((file) => file.endsWith(".ts")).map((file) => path.join(groups, file)))
        for (const file of composition) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /process\.env|EnvSource|parse\w+Config\s*\(/, `${file} only consumes parsed values`)
    })
}
