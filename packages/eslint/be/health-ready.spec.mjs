// proves: BE_READY_REAL@lite BE_READY_REAL@full BE_HEALTH_SIGNALS@lite BE_HEALTH_SIGNALS@full HFS_DOCKER_HEALTHCHECK_FAKE@lite HFS_DOCKER_HEALTHCHECK_FAKE@full
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { healthSignals, readyReal, rules } from "./health-ready.mjs"
import { dockerFindings, NODE_IMAGE } from "../../../scripts/hfs/rules/docker.mjs"

const fixtures = []
test.after(() => { for (const root of fixtures) fs.rmSync(root, { recursive: true, force: true }) })
const fixture = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "starci-health-ready-"))
    fixtures.push(root)
    return root
}
const put = (root, filename, code) => {
    const target = path.join(root, filename)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, code)
    return target
}
const declaration = (edition) => ({ ...appDeclaration("be", { apps: [{ name: "api", kind: "api" }, { name: "worker", kind: "worker" }] }), edition })
const testerOf = (root, edition) => new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    settings: { starci: { hfs: hfsFromDeclaration(declaration(edition), root) } },
})
const ready = (body, constructor = "constructor(private readonly required: RequiredProbe) {}", route = "ready") => `@Controller("health") class ReadyController { ${constructor} @Get("${route}") ready() { ${body} } }`
const bounded = "return Promise.race([this.required.check(), new Promise((resolve, reject) => setTimeout(() => reject(new Error('unavailable')), 1000))])"
const liveController = '@Controller("health") export class LiveController { @Get("live") live() { return { ok: true } } }'
const readyController = ready(bounded).replace("class ReadyController", "export class ReadyController")

test("R262 exports the two rules", () => {
    assert.deepEqual(Object.keys(rules), ["ready-real", "health-signals"])
})

for (const edition of ["lite", "full"]) {
    test(`BE_READY_REAL@${edition}: dependency probes are bounded and liveness aliases fail`, () => {
        const root = fixture()
        const filename = path.join(root, "src/features/api/system-health/transport/http/ready.controller.ts")
        testerOf(root, edition).run("ready-real", readyReal, {
            valid: [
                { filename, code: ready(bounded) },
                { filename, code: ready("return this.required.check({ signal: AbortSignal.timeout(1500) })") },
                { filename, code: `const TIMEOUT=1000; ${ready("const failure = new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT)); return Promise.race([this.required.check(), failure])")}` },
                { filename, code: ready(bounded, undefined, "readyz") },
                { filename, code: ready("return this.queryBus.execute(new CheckLivenessQuery())", "constructor(private readonly queryBus: QueryBus) {}", "live") },
            ],
            invalid: [
                { filename, code: ready("return this.queryBus.execute(new CheckLivenessQuery())", "constructor(private readonly queryBus: QueryBus) {}"), errors: [{ messageId: "real" }] },
                { filename, code: ready("return this.queryBus.execute(new CheckLivenessQuery())", "constructor(private readonly queryBus: QueryBus) {}", "readyz"), errors: [{ messageId: "real" }] },
                { filename, code: ready("return { ok: true }", ""), errors: [{ messageId: "real" }] },
                { filename, code: ready("return this.required.check()"), errors: [{ messageId: "real" }] },
                { filename, code: ready(bounded.replace("reject(new Error('unavailable'))", "resolve(true)")), errors: [{ messageId: "real" }] },
                { filename, code: ready(bounded.replace("1000", "0")), errors: [{ messageId: "real" }] },
                { filename, code: ready(bounded.replace("1000", "-1000")), errors: [{ messageId: "real" }] },
                { filename, code: ready(bounded.replace("1000", "unbounded")), errors: [{ messageId: "real" }] },
                { filename, code: ready(bounded.replace("this.required.check()", "this.liveness.check()"), "constructor(private readonly liveness: LivenessService) {}"), errors: [{ messageId: "real" }] },
                { filename, code: ready(`try { await ${bounded.replace("return ", "")} } catch {} return {ok:true}`), errors: [{ messageId: "real" }] },
                { filename, code: ready(`${bounded.replace("return ", "")} ; return {ok:true}`), errors: [{ messageId: "real" }] },
                { filename, code: ready(`${bounded}.catch(() => ({ok:true}))`), errors: [{ messageId: "real" }] },
                { filename, code: ready(bounded.replace("reject(new Error('unavailable'))", "{ throw new Error('unavailable') }")), errors: [{ messageId: "real" }] },
            ],
        })
    })

    test(`BE_READY_REAL@${edition}: thin readiness controllers delegate to the actual bounded dependency service`, () => {
        const root = fixture()
        const filename = path.join(root, "src/features/api/system-health/transport/http/ready.controller.ts")
        const service = 'export class ReadinessService { constructor(private readonly entityManager: EntityManager) {} probeRequired() { const TIMEOUT = 1000; const failure = new Promise((resolve, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT)); return Promise.race([this.entityManager.transaction(async () => undefined), failure]) } }'
        put(root, "src/modules/platform/http-security/readiness.service.ts", service)
        put(root, "src/modules/platform/http-security/index.ts", 'export { ReadinessService } from "./readiness.service"')
        const code = 'import { ReadinessService } from "@modules/platform/http-security"; ' + ready("return this.readiness.probeRequired()", "constructor(private readonly readiness: ReadinessService) {}")
        testerOf(root, edition).run("ready-real", readyReal, {
            valid: [{ filename, code }],
            invalid: [
                { filename, code: code.replace("probeRequired()", "liveness()"), errors: [{ messageId: "real" }] },
                { filename, code: code.replace("return this.readiness.probeRequired()", "this.readiness.probeRequired(); return {ok:true}"), errors: [{ messageId: "real" }] },
            ],
        })
    })

    test(`BE_HEALTH_SIGNALS@${edition}: each API app registers both live and ready controllers`, () => {
        const complete = fixture()
        const missing = fixture()
        for (const root of [complete, missing]) {
            put(root, "src/features/api/system-health/transport/http/live.controller.ts", liveController)
            put(root, "src/features/api/system-health/transport/http/ready.controller.ts", readyController)
            put(root, "apps/api/src/app.module.ts", 'import { HealthModule } from "@features/api/system-health/transport/http/health.module"; @Module({imports:[HealthModule]}) export class AppModule {}')
        }
        put(complete, "src/features/api/system-health/transport/http/health.module.ts", 'import {LiveController} from "./live.controller"; import {ReadyController} from "./ready.controller"; @Module({ controllers:[LiveController,ReadyController] }) export class HealthModule {}')
        put(missing, "src/features/api/system-health/transport/http/health.module.ts", 'import {LiveController} from "./live.controller"; import {ReadyController} from "./ready.controller"; void ReadyController; const unused=[ReadyController]; @Module({ controllers:[LiveController] }) export class HealthModule {}')
        testerOf(complete, edition).run("health-signals", healthSignals, {
            valid: [{ filename: path.join(complete, "apps/api/src/main.ts"), code: "bootstrap()" }, { filename: path.join(complete, "apps/worker/src/main.ts"), code: "bootstrap()" }],
            invalid: [{ filename: path.join(missing, "apps/api/src/main.ts"), code: "bootstrap()", settings: { starci: { hfs: hfsFromDeclaration(declaration(edition), missing) } }, errors: [{ messageId: "signals", data: { app: "api", missing: "/health/ready" } }] }],
        })
    })
}

const dockerText = (health) => `# docker build -f be/apps/api/Dockerfile -t fixture/api:tag .
FROM ${NODE_IMAGE} AS build
RUN npm ci --ignore-scripts
FROM ${NODE_IMAGE} AS runtime
RUN npm ci --omit=dev --ignore-scripts
ENV PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --timeout=5s CMD ${health}
CMD ["node", "be/dist/apps/api/src/main.js"]
`
const dockerCodes = (root, edition, health, withRoute = true) => {
    const file = put(root, "be/apps/api/Dockerfile", dockerText(health))
    put(root, "be/apps/api/src/app.module.ts", withRoute ? 'import { HealthModule } from "@features/api/system-health/transport/http/health.module"; @Module({imports:[HealthModule]}) export class AppModule {}' : 'import { HealthModule } from "@features/api/system-health/transport/http/health.module"; void HealthModule; const unused=[HealthModule]; export class AppModule {}')
    put(root, "be/src/features/api/system-health/transport/http/health.module.ts", 'import { LiveController } from "./live.controller"; @Module({controllers:[LiveController]}) export class HealthModule {}')
    put(root, "be/src/features/api/system-health/transport/http/live.controller.ts", liveController)
    return dockerFindings({ repoRoot: root, files: [path.relative(root, file).replaceAll("\\", "/")], repo: declaration(edition) }).filter((entry) => entry.code === "HFS_DOCKER_HEALTHCHECK_FAKE")
}
for (const edition of ["lite", "full"]) {
    test(`HFS_DOCKER_HEALTHCHECK_FAKE@${edition}: the API check reaches its registered local live route`, () => {
        const root = fixture()
        assert.deepEqual(dockerCodes(root, edition, 'node -e "fetch(\'http://127.0.0.1:\'+process.env.PORT+\'/health/live\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"'), [])
        assert.deepEqual(dockerCodes(root, edition, 'curl -fsS http://localhost:3000/health/live'), [])
        assert.deepEqual(dockerCodes(root, edition, '["wget", "--spider", "http://127.0.0.1:3000/health/live"]'), [])
        for (const health of ['true', '["true"]', 'curl -fsS http://localhost:3000/readyz', 'curl -fsS http://localhost:8080/health/live', 'curl -fsS https://elsewhere.example/health/live', 'curl -fsS http://localhost:3000/health/live || true', 'curl -fsS http://localhost:3000/health/live; echo ok', 'curl -fsS http://localhost:3000/health/live || echo ok', 'node -e "console.log(\'http://127.0.0.1:3000/health/live\')"', 'node -e "fetch(\'http://127.0.0.1:3000/health/live\').then(()=>process.exit(0))"', 'node -e "fetch(\'http://127.0.0.1:3000/health/live\'); const response={ok:true}; response.ok; function dead(){process.exit(1)}"', 'node -e "function dead(){fetch(\'http://127.0.0.1:3000/health/live\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))}"']) assert.equal(dockerCodes(root, edition, health).length, 1, health)
        assert.equal(dockerCodes(root, edition, 'curl -fsS http://localhost:3000/health/live', false).length, 1, "the live route is not installed")
    })

    test(`HFS_DOCKER_HEALTHCHECK_FAKE@${edition}: FE, workers and one-shot commands retain their health policy`, () => {
        const root = fixture()
        for (const [side, name, kind, health] of [["be", "worker", "worker", "CMD true"], ["be", "cli", "cli", "NONE"], ["fe", "web", "next", "CMD true"]]) {
            const filename = `${side}/apps/${name}/Dockerfile`
            put(root, filename, dockerText("true").replace(/HEALTHCHECK.*\n/, `HEALTHCHECK ${health}\n`))
            const repo = { ...declaration(edition), sides: { be: { apps: side === "be" ? [{ name, kind }] : [] }, fe: { apps: side === "fe" ? [{ name, kind }] : [] } } }
            assert.deepEqual(dockerFindings({ repoRoot: root, files: [filename], repo }).filter((entry) => entry.code === "HFS_DOCKER_HEALTHCHECK_FAKE"), [])
        }
    })
}
