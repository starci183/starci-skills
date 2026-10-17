// proves: HFS_DOCKER_HEALTHCHECK_FAKE@lite HFS_DOCKER_HEALTHCHECK_FAKE@full
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { appDeclaration } from "../../packages/eslint/be/fixtures/app.mjs"
import { dockerFindings, NODE_IMAGE } from "../../scripts/hfs/rules/docker.mjs"

const fixtures = []
test.after(() => { for (const root of fixtures) fs.rmSync(root, { recursive: true, force: true }) })
const fixture = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "starci-docker-health-"))
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
const liveController = '@Controller("health") export class LiveController { @Get("live") live() { return { ok: true } } }'

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
