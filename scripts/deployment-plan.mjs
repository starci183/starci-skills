#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const defaultSource = resolve(trustRoot, "..")
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const hostname = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const sensitiveKey = /(password|secret|token|private[-_]?key|api[-_]?key)/i

const fail = (message) => { throw new Error(`deployment-plan: ${message}`) }
const valueFor = (args, name) => {
    const at = args.indexOf(name)
    if (at < 0) return null
    const value = args[at + 1]
    if (!value || value.startsWith("--")) fail(`${name} needs a value`)
    return value
}

const parseArgs = (args) => {
    const allowed = new Set(["--source", "--project", "--owner-role", "--environment", "--manifest", "--plan", "--init", "--self-test"])
    for (let index = 0; index < args.length; index += 1) {
        if (!allowed.has(args[index])) fail(`unknown argument: ${args[index]}`)
        if (!new Set(["--plan", "--init", "--self-test"]).has(args[index])) index += 1
    }
    if (args.includes("--self-test")) return { selfTest: true }
    if (args.includes("--plan") === args.includes("--init")) fail("choose exactly one of --plan or --init")
    const input = {
        source: resolve(valueFor(args, "--source") ?? defaultSource),
        project: valueFor(args, "--project"),
        ownerRole: valueFor(args, "--owner-role") ?? "be",
        environment: valueFor(args, "--environment") ?? "production",
        manifest: valueFor(args, "--manifest") ?? ".stacks/deployment.json",
        init: args.includes("--init"),
    }
    if (!input.project || !slug.test(input.project)) fail("--project must be a lowercase project slug")
    if (!slug.test(input.ownerRole)) fail("--owner-role must be a role slug")
    if (!slug.test(input.environment)) fail("--environment must be an environment slug")
    return input
}

const readJson = (path, label) => {
    if (!existsSync(path)) fail(`${label} is missing: ${path}`)
    try { return JSON.parse(readFileSync(path, "utf8")) }
    catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}

const safeRelative = (value, label) => {
    if (typeof value !== "string" || !value || isAbsolute(value) || value.split(/[\\/]/).includes("..")) fail(`${label} must be a repository-relative path without ..`)
    return value.replaceAll("\\", "/")
}

const assertNoInlineSecrets = (value, path = "manifest") => {
    if (Array.isArray(value)) return value.forEach((item, index) => assertNoInlineSecrets(item, `${path}[${index}]`))
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
        if (sensitiveKey.test(key) && key !== "credentialRefs" && typeof child === "string" && child.trim()) {
            fail(`${path}.${key} looks like an inline credential; store only a reference under stack.credentialRefs`)
        }
        assertNoInlineSecrets(child, `${path}.${key}`)
    }
}

const unique = (values, label) => {
    if (new Set(values).size !== values.length) fail(`${label} contains duplicates`)
}

const assertKeys = (value, label, allowed, required = []) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`)
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}.${key} is not allowed by deployment schema`)
    for (const key of required) if (!(key in value)) fail(`${label}.${key} is required`)
}

const nonEmptyStrings = (values, label) => {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) fail(`${label} must contain non-empty strings`)
}

const validateManifest = (manifest) => {
    assertNoInlineSecrets(manifest)
    assertKeys(manifest, "manifest", ["$schema", "version", "project", "environment", "ownerRole", "roles", "stack", "infra", "host", "artifacts", "domains", "deploy", "monitor"], ["version", "project", "environment", "ownerRole", "roles", "stack", "infra", "host", "artifacts", "domains", "deploy", "monitor"])
    if (manifest.version !== 1) fail("manifest.version must be 1")
    for (const field of ["project", "environment", "ownerRole"]) if (!slug.test(manifest[field] ?? "")) fail(`manifest.${field} must be a slug`)
    if (!Array.isArray(manifest.roles) || manifest.roles.length === 0 || manifest.roles.some((role) => !slug.test(role))) fail("manifest.roles must contain role slugs")
    unique(manifest.roles, "manifest.roles")
    if (!manifest.roles.includes(manifest.ownerRole)) fail("manifest.ownerRole must be included in manifest.roles")
    assertKeys(manifest.stack, "manifest.stack", ["root", "runtime", "credentialRefs"], ["root", "runtime", "credentialRefs"])
    const stackRoot = safeRelative(manifest.stack.root, "manifest.stack.root")
    if (!/^\.stacks\/[^/]+$/.test(stackRoot)) fail("manifest.stack.root must identify one .stacks environment")
    if (!new Set(["docker-swarm", "docker-compose", "kubernetes"]).has(manifest.stack?.runtime)) fail("manifest.stack.runtime is unsupported")
    nonEmptyStrings(manifest.stack.credentialRefs, "manifest.stack.credentialRefs")
    unique(manifest.stack.credentialRefs, "manifest.stack.credentialRefs")
    assertKeys(manifest.infra, "manifest.infra", ["root", "workingDirectories"], ["root", "workingDirectories"])
    const infraRoot = safeRelative(manifest.infra.root, "manifest.infra.root")
    if (infraRoot !== `.infra/${manifest.environment}`) fail("manifest.infra.root must be .infra/<environment>")
    if (!Array.isArray(manifest.infra?.workingDirectories)) fail("manifest.infra.workingDirectories must be an array")
    for (const directory of manifest.infra.workingDirectories) if (!slug.test(directory)) fail("infra working directory names must be slugs")
    assertKeys(manifest.host, "manifest.host", ["transport", "addressRef", "userRef", "portRef", "forbiddenAddressRefs", "runtimeSetup"], ["transport", "addressRef", "runtimeSetup"])
    if (manifest.host.transport !== "ssh") fail("manifest.host.transport must be ssh")
    for (const field of ["addressRef", "userRef", "portRef"]) if (field in manifest.host && (typeof manifest.host[field] !== "string" || !manifest.host[field].trim())) fail(`manifest.host.${field} must be a non-empty reference`)
    if ("forbiddenAddressRefs" in manifest.host) {
        nonEmptyStrings(manifest.host.forbiddenAddressRefs, "manifest.host.forbiddenAddressRefs")
        unique(manifest.host.forbiddenAddressRefs, "manifest.host.forbiddenAddressRefs")
    }
    assertKeys(manifest.host.runtimeSetup, "manifest.host.runtimeSetup", ["driver", "path"], ["driver", "path"])
    if (!new Set(["script", "terraform-template"]).has(manifest.host.runtimeSetup.driver)) fail("manifest.host.runtimeSetup.driver is unsupported")
    safeRelative(manifest.host.runtimeSetup.path, "manifest.host.runtimeSetup.path")
    if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) fail("manifest.artifacts must not be empty")
    unique(manifest.artifacts.map((item) => item.name), "artifact names")
    for (const item of manifest.artifacts) {
        assertKeys(item, `artifact ${item?.name ?? "<missing>"}`, ["name", "role", "source", "image", "target", "frontend"], ["name", "role", "source", "image", "target"])
        if (!slug.test(item.name ?? "") || !manifest.roles.includes(item.role)) fail("each artifact needs a unique slug name and routed role")
        safeRelative(item.source, `artifact ${item.name} source`)
        if (typeof item.image !== "string" || !item.image.trim() || typeof item.target !== "string" || !item.target.trim()) fail(`artifact ${item.name} needs image and target`)
        if ("frontend" in item) {
            assertKeys(item.frontend, `artifact ${item.name} frontend`, ["framework", "layout", "surface", "buildContext", "dockerfile", "stackDefinition"], ["framework", "layout", "surface", "buildContext", "dockerfile", "stackDefinition"])
            if (item.frontend.framework !== "nextjs") fail(`artifact ${item.name} frontend framework must be nextjs`)
            if (!new Set(["single-app", "monorepo"]).has(item.frontend.layout)) fail(`artifact ${item.name} frontend layout is unsupported`)
            if (!slug.test(item.frontend.surface ?? "")) fail(`artifact ${item.name} frontend surface must be a slug`)
            safeRelative(item.frontend.buildContext, `artifact ${item.name} frontend buildContext`)
            safeRelative(item.frontend.dockerfile, `artifact ${item.name} frontend dockerfile`)
            const stackDefinition = safeRelative(item.frontend.stackDefinition, `artifact ${item.name} frontend stackDefinition`)
            if (!stackDefinition.startsWith(`${stackRoot}/frontend/${item.frontend.surface}/`)) fail(`artifact ${item.name} frontend stackDefinition must live under ${stackRoot}/frontend/${item.frontend.surface}`)
        }
    }
    if (!Array.isArray(manifest.domains)) fail("manifest.domains must be an array")
    unique(manifest.domains.map((route) => route.hostname), "deployment hostnames")
    for (const route of manifest.domains) {
        assertKeys(route, `domain ${route?.hostname ?? "<missing>"}`, ["hostname", "owner", "driver", "definition", "artifact", "primary", "origin", "tunnel"], ["hostname", "owner", "driver", "definition"])
        if (!hostname.test(route.hostname ?? "")) fail(`invalid deployment hostname: ${route.hostname ?? "<missing>"}`)
        if (!new Set(["platform", "tenant", "shared"]).has(route.owner)) fail(`domain ${route.hostname} has no valid owner`)
        if (!new Set(["terraform", "cloudflare-tunnel"]).has(route.driver)) fail(`domain ${route.hostname} has no valid driver`)
        safeRelative(route.definition, `domain ${route.hostname} definition`)
        if ("artifact" in route && !manifest.artifacts.some((artifact) => artifact.name === route.artifact)) fail(`domain ${route.hostname} references an undeclared artifact`)
        if ("primary" in route && typeof route.primary !== "boolean") fail(`domain ${route.hostname} primary must be boolean`)
        if (route.primary && !route.artifact) fail(`domain ${route.hostname} cannot be primary without an artifact`)
        if (route.driver === "cloudflare-tunnel" && (!route.origin || !route.tunnel)) fail(`tunnel domain ${route.hostname} needs origin and tunnel`)
        if (route.driver === "terraform" && (route.origin || route.tunnel)) fail(`terraform domain ${route.hostname} must leave origin/tunnel to its definition`)
    }
    const frontendArtifacts = manifest.artifacts.filter((artifact) => artifact.frontend)
    unique(frontendArtifacts.map((artifact) => artifact.frontend.surface), "frontend surfaces")
    for (const role of new Set(frontendArtifacts.map((artifact) => artifact.role))) {
        const roleArtifacts = frontendArtifacts.filter((artifact) => artifact.role === role)
        if (new Set(roleArtifacts.map((artifact) => artifact.frontend.layout)).size !== 1) fail(`frontend role ${role} cannot mix repository layouts`)
        if (roleArtifacts[0]?.frontend.layout === "single-app" && roleArtifacts.length !== 1) fail(`single-app frontend role ${role} must own exactly one surface`)
    }
    for (const artifact of frontendArtifacts) {
        const mapped = manifest.domains.filter((route) => route.artifact === artifact.name)
        if (mapped.length === 0) fail(`frontend artifact ${artifact.name} needs a declared domain`)
        const explicitPrimary = mapped.filter((route) => route.primary)
        if (mapped.length > 1 && explicitPrimary.length !== 1) fail(`frontend artifact ${artifact.name} needs exactly one primary domain when aliases exist`)
        if (explicitPrimary.length > 1) fail(`frontend artifact ${artifact.name} has multiple primary domains`)
    }
    assertKeys(manifest.deploy, "manifest.deploy", ["driver", "role", "workflow", "ref", "rollbackInput", "verification"], ["driver", "role", "workflow", "ref", "verification"])
    if (!new Set(["github-actions", "local"]).has(manifest.deploy.driver) || !manifest.roles.includes(manifest.deploy.role)) fail("manifest.deploy has no valid driver/role")
    safeRelative(manifest.deploy.workflow, "manifest.deploy.workflow")
    if (typeof manifest.deploy.ref !== "string" || !manifest.deploy.ref.trim()) fail("manifest.deploy.ref must not be empty")
    if ("rollbackInput" in manifest.deploy && (typeof manifest.deploy.rollbackInput !== "string" || !manifest.deploy.rollbackInput.trim())) fail("manifest.deploy.rollbackInput must not be empty")
    nonEmptyStrings(manifest.deploy.verification, "manifest.deploy.verification")
    if (manifest.deploy.verification.length === 0) fail("manifest.deploy.verification must not be empty")
    assertKeys(manifest.monitor, "manifest.monitor", ["intervalSeconds", "steadySeconds", "timeoutSeconds", "probes"], ["intervalSeconds", "steadySeconds", "timeoutSeconds", "probes"])
    const monitor = manifest.monitor
    if (!Number.isInteger(monitor?.intervalSeconds) || monitor.intervalSeconds < 5) fail("monitor.intervalSeconds must be at least 5")
    if (!Number.isInteger(monitor?.steadySeconds) || monitor.steadySeconds < 0) fail("monitor.steadySeconds must be non-negative")
    if (!Number.isInteger(monitor?.timeoutSeconds) || monitor.timeoutSeconds < 30) fail("monitor.timeoutSeconds must be at least 30")
    if (!Array.isArray(monitor.probes) || monitor.probes.length === 0) fail("monitor.probes must not be empty")
    unique(monitor.probes.map((probe) => probe.name), "monitor probe names")
    for (const probe of monitor.probes) {
        assertKeys(probe, `monitor probe ${probe?.name ?? "<missing>"}`, ["name", "kind", "target", "expectedStatus", "role"], ["name", "kind", "target"])
        if (!slug.test(probe.name ?? "")) fail("monitor probe names must be slugs")
        if (!new Set(["http", "tcp", "swarm-service", "kubernetes", "command"]).has(probe.kind)) fail(`monitor probe ${probe.name} has an unsupported kind`)
        if (typeof probe.target !== "string" || !probe.target.trim()) fail(`monitor probe ${probe.name} needs a target`)
        if ("expectedStatus" in probe && (!Number.isInteger(probe.expectedStatus) || probe.expectedStatus < 100 || probe.expectedStatus > 599)) fail(`monitor probe ${probe.name} has an invalid expectedStatus`)
        if ("role" in probe && !manifest.roles.includes(probe.role)) fail(`monitor probe ${probe.name} references an undeclared role`)
    }
    return { stackRoot, infraRoot }
}

const git = (repo, args) => spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", windowsHide: true })
const resolveRoute = (source, project, role) => {
    const routePath = join(source, ".workspaces", "local", "routes", project, role, "config.json")
    const route = readJson(routePath, `${project}/${role} route`)
    if (route.project !== project || route.role !== role) fail(`${project}/${role} route has the wrong identity`)
    const repository = resolve(route.repository?.diskPath ?? "")
    if (!existsSync(repository) || resolve(route.repository?.gitRoot ?? "") !== repository) fail(`${project}/${role} checkout is absent or has the wrong git root`)
    const gitRoot = git(repository, ["rev-parse", "--show-toplevel"])
    if (gitRoot.status !== 0 || resolve(gitRoot.stdout.trim()) !== repository) fail(`${project}/${role} disk path is not the real Git root`)
    const branch = git(repository, ["branch", "--show-current"])
    if (branch.status !== 0 || branch.stdout.trim() !== route.repository.branch) fail(`${project}/${role} is not on routed branch ${route.repository.branch}`)
    const reachable = git(repository, ["cat-file", "-e", `${route.repository.head}^{commit}`])
    if (reachable.status !== 0) fail(`${project}/${role} cannot reach routed head ${route.repository.head}`)
    for (const path of route.context?.manifests ?? []) if (!existsSync(path)) fail(`${project}/${role} manifest is absent: ${path}`)
    if (route.context?.contract && !existsSync(route.context.contract)) fail(`${project}/${role} contract is absent: ${route.context.contract}`)
    return { routePath, repository, branch: branch.stdout.trim(), head: git(repository, ["rev-parse", "HEAD"]).stdout.trim() }
}

const inside = (root, relative) => {
    const target = resolve(root, relative)
    if (target !== root && !target.startsWith(`${root}${sep}`)) fail(`path escapes repository: ${relative}`)
    return target
}

const createPlan = (input) => {
    const owner = resolveRoute(input.source, input.project, input.ownerRole)
    const manifestPath = inside(owner.repository, input.manifest)
    const manifest = readJson(manifestPath, "deployment manifest")
    const { stackRoot, infraRoot } = validateManifest(manifest)
    if (manifest.project !== input.project || manifest.ownerRole !== input.ownerRole || manifest.environment !== input.environment) fail("requested project/role/environment do not match deployment manifest")
    const routes = Object.fromEntries(manifest.roles.map((role) => [role, resolveRoute(input.source, input.project, role)]))
    for (const artifact of manifest.artifacts) {
        if (!existsSync(inside(routes[artifact.role].repository, artifact.source))) fail(`artifact source is absent: ${artifact.role}/${artifact.source}`)
        if (artifact.frontend) {
            if (!existsSync(inside(routes[artifact.role].repository, artifact.frontend.buildContext))) fail(`frontend build context is absent: ${artifact.role}/${artifact.frontend.buildContext}`)
            if (!existsSync(inside(routes[artifact.role].repository, artifact.frontend.dockerfile))) fail(`frontend Dockerfile is absent: ${artifact.role}/${artifact.frontend.dockerfile}`)
            if (!existsSync(inside(owner.repository, artifact.frontend.stackDefinition))) fail(`frontend stack definition is absent: ${artifact.frontend.stackDefinition}`)
        }
    }
    if (!existsSync(inside(owner.repository, stackRoot))) fail(`stack root is absent: ${stackRoot}`)
    if (!existsSync(inside(routes[manifest.deploy.role].repository, manifest.deploy.workflow))) fail(`deploy workflow is absent: ${manifest.deploy.workflow}`)
    if (!existsSync(inside(owner.repository, manifest.host.runtimeSetup.path))) fail(`runtime setup source is absent: ${manifest.host.runtimeSetup.path}`)
    for (const route of manifest.domains) if (!existsSync(inside(owner.repository, route.definition))) fail(`domain definition is absent: ${route.definition}`)
    return {
        version: 1,
        project: manifest.project,
        environment: manifest.environment,
        ownerRole: manifest.ownerRole,
        ownerRepository: owner.repository,
        manifestPath,
        infraRoot: inside(owner.repository, infraRoot),
        stackRoot: inside(owner.repository, stackRoot),
        routes: Object.fromEntries(Object.entries(routes).map(([role, route]) => [role, { repository: route.repository, branch: route.branch, head: route.head }])),
        runtime: manifest.stack.runtime,
        credentialRefs: manifest.stack.credentialRefs,
        host: manifest.host,
        artifacts: manifest.artifacts,
        domains: manifest.domains,
        deploy: manifest.deploy,
        monitor: manifest.monitor,
        workingDirectories: manifest.infra.workingDirectories,
    }
}

const printPlan = (plan) => {
    console.log(`deployment: ${plan.project}/${plan.environment}`)
    console.log(`owner: ${plan.ownerRole} -> ${plan.ownerRepository}`)
    console.log(`runtime: ${plan.runtime}; stack ${plan.stackRoot}`)
    console.log(`infra: ${plan.infraRoot}`)
    console.log(`roles: ${Object.keys(plan.routes).join(", ")}`)
    console.log(`artifacts: ${plan.artifacts.map((item) => item.name).join(", ")}`)
    const frontends = plan.artifacts.filter((item) => item.frontend)
    if (frontends.length) console.log(`frontends: ${frontends.map((item) => `${item.name} (${item.frontend.framework}/${item.frontend.layout}/${item.frontend.surface})`).join(", ")}`)
    console.log(`domains: ${plan.domains.map((item) => `${item.hostname} (${item.owner}/${item.driver})`).join(", ") || "none"}`)
    console.log(`deploy: ${plan.deploy.driver} ${plan.deploy.workflow}@${plan.deploy.ref}`)
    console.log(`monitor: ${plan.monitor.probes.length} probes; ${plan.monitor.steadySeconds}s steady window; ${plan.monitor.timeoutSeconds}s timeout`)
    console.log(`credentials: ${plan.credentialRefs.length} references; values never read or printed`)
}

const initInfra = (plan) => {
    const relativeProbe = normalize(plan.infraRoot.slice(plan.ownerRepository.length)).replace(/^[/\\]+/, "") || ".infra"
    const ignored = git(plan.ownerRepository, ["check-ignore", "-q", "--no-index", `${relativeProbe}/.starci-probe`])
    if (ignored.status !== 0) fail(`${relativeProbe} is not fully gitignored; refuse to create execution state`)
    mkdirSync(plan.infraRoot, { recursive: true })
    for (const directory of plan.workingDirectories) mkdirSync(join(plan.infraRoot, directory), { recursive: true })
    mkdirSync(join(plan.infraRoot, "monitor"), { recursive: true })
    const materialized = { ...plan, generatedAt: new Date().toISOString() }
    writeFileSync(join(plan.infraRoot, "plan.json"), `${JSON.stringify(materialized, null, 2)}\n`, "utf8")
    writeFileSync(join(plan.infraRoot, "monitor", "state.json"), `${JSON.stringify({ version: 1, status: "not-started", observations: [] }, null, 2)}\n`, "utf8")
    console.log("infra: initialized (ignored execution state; no credential values)")
}

const selfTest = () => {
    const sample = {
        version: 1, project: "example", environment: "production", ownerRole: "be", roles: ["fe", "be"],
        stack: { root: ".stacks/vps", runtime: "docker-swarm", credentialRefs: ["vps/runtime/files/api.key.enc"] },
        infra: { root: ".infra/production", workingDirectories: ["terraform", "ssh", "cloudflare"] },
        host: { transport: "ssh", addressRef: "vps/infra/ssh/vps.env.enc#VPS_HOST", forbiddenAddressRefs: [], runtimeSetup: { driver: "terraform-template", path: ".stacks/vps/infra/terraform/scripts/host-prep.sh.tftpl" } },
        artifacts: [{ name: "api", role: "be", source: "apps/api", image: "ghcr.io/example/api:${BE_SHA}", target: "swarm:example_api" }],
        domains: [{ hostname: "api.example.com", owner: "platform", driver: "terraform", definition: ".stacks/vps/infra/terraform/dns.tf" }],
        deploy: { driver: "github-actions", role: "be", workflow: ".github/workflows/deploy.yml", ref: "main", verification: ["https://api.example.com/health"] },
        monitor: { intervalSeconds: 10, steadySeconds: 30, timeoutSeconds: 300, probes: [{ name: "api-health", kind: "http", target: "https://api.example.com/health", expectedStatus: 200 }] },
    }
    assert.deepEqual(validateManifest(sample), { stackRoot: ".stacks/vps", infraRoot: ".infra/production" })
    assert.throws(() => validateManifest({ ...sample, infra: { ...sample.infra, root: ".infra/staging" } }), /infra.root/)
    assert.throws(() => validateManifest({ ...sample, apiToken: "not-a-real-value" }), /inline credential/)
    assert.throws(() => validateManifest({ ...sample, surprise: true }), /not allowed/)
    assert.throws(() => validateManifest({ ...sample, monitor: { ...sample.monitor, probes: [{ ...sample.monitor.probes[0], role: "missing" }] } }), /undeclared role/)
    const frontendSample = {
        ...sample,
        ownerRole: "fe",
        roles: ["fe"],
        artifacts: [
            { name: "landing", role: "fe", source: "apps/landing", image: "ghcr.io/example/landing:${FE_SHA}", target: "swarm:example_landing", frontend: { framework: "nextjs", layout: "monorepo", surface: "landing", buildContext: ".", dockerfile: "apps/landing/Dockerfile", stackDefinition: ".stacks/vps/frontend/landing/stack.yml" } },
            { name: "crm", role: "fe", source: "apps/crm", image: "ghcr.io/example/crm:${FE_SHA}", target: "swarm:example_crm", frontend: { framework: "nextjs", layout: "monorepo", surface: "crm", buildContext: ".", dockerfile: "apps/crm/Dockerfile", stackDefinition: ".stacks/vps/frontend/crm/stack.yml" } },
        ],
        domains: [
            { hostname: "example.com", owner: "platform", driver: "terraform", definition: ".stacks/vps/infra/terraform/dns.tf", artifact: "landing", primary: true },
            { hostname: "crm.example.com", owner: "platform", driver: "terraform", definition: ".stacks/vps/infra/terraform/dns.tf", artifact: "crm", primary: true },
        ],
        deploy: { ...sample.deploy, role: "fe" },
    }
    assert.deepEqual(validateManifest(frontendSample), { stackRoot: ".stacks/vps", infraRoot: ".infra/production" })
    assert.deepEqual(validateManifest({ ...frontendSample, domains: frontendSample.domains.map((route) => route.artifact === "crm" ? { ...route, hostname: "members.example.net" } : route) }), { stackRoot: ".stacks/vps", infraRoot: ".infra/production" })
    assert.throws(() => validateManifest({ ...frontendSample, artifacts: frontendSample.artifacts.map((artifact) => artifact.name === "crm" ? { ...artifact, frontend: { ...artifact.frontend, surface: "CRM App" } } : artifact) }), /surface must be a slug/)
    assert.throws(() => validateManifest({ ...frontendSample, artifacts: frontendSample.artifacts.map((artifact) => artifact.name === "crm" ? { ...artifact, frontend: { ...artifact.frontend, stackDefinition: ".stacks/vps/crm/stack.yml" } } : artifact) }), /must live under .stacks\/vps\/frontend\/crm/)
    assert.throws(() => validateManifest({ ...frontendSample, domains: frontendSample.domains.filter((route) => route.artifact !== "crm") }), /frontend artifact crm needs a declared domain/)
    assert.throws(() => validateManifest({ ...frontendSample, domains: frontendSample.domains.map((route) => ({ ...route, artifact: "missing" })) }), /undeclared artifact/)
    assert.throws(() => safeRelative("../escape", "probe"), /repository-relative/)
    console.log("deployment-plan self-test: pass (no filesystem or external mutations)")
}

const main = () => {
    const input = parseArgs(process.argv.slice(2))
    if (input.selfTest) return selfTest()
    const plan = createPlan(input)
    printPlan(plan)
    if (input.init) initInfra(plan)
}

try { main() }
catch (error) {
    console.error(error instanceof Error ? error.message : "deployment-plan: failed")
    process.exit(1)
}
