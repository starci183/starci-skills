#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { delimiter, dirname, join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"

const API_ROOT = "https://api.cloudflare.com/client/v4"
const API_RECORD = "cloudflare-api-token.key.enc"
const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceRoot = resolve(trustRoot, "..")

const fail = (message) => {
    throw new Error(`cloudflare-tunnel-set: ${message}`)
}

const valueFor = (args, flag) => {
    const at = args.indexOf(flag)
    if (at < 0) return null
    const value = args[at + 1]
    if (!value || value.startsWith("--")) fail(`${flag} needs a value`)
    return value
}

const parseArgs = (args) => {
    const allowed = new Set(["--project", "--role", "--zone", "--hostname", "--service", "--tunnel", "--plan", "--self-test"])
    for (let index = 0; index < args.length; index += 1) {
        const item = args[index]
        if (!allowed.has(item)) fail(`unknown argument: ${item}`)
        if (item !== "--plan" && item !== "--self-test") index += 1
    }
    const values = Object.fromEntries(["project", "role", "zone", "hostname", "service", "tunnel"].map((name) => [name, valueFor(args, `--${name}`)]))
    if (args.includes("--self-test")) return { selfTest: true }
    for (const [name, value] of Object.entries(values)) if (!value) fail(`--${name} is required`)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(values.project)) fail("--project must be a lowercase workspace project name")
    if (!/^[a-z][a-z0-9-]*$/.test(values.role)) fail("--role must be a workspace role")
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(values.tunnel)) fail("--tunnel must be a Cloudflare tunnel name")
    values.zone = normalizeDns(values.zone, "zone")
    values.hostname = normalizeDns(values.hostname, "hostname")
    if (values.hostname !== values.zone && !values.hostname.endsWith(`.${values.zone}`)) fail("--hostname must belong to --zone")
    values.service = validateService(values.service)
    return { ...values, plan: args.includes("--plan") }
}

const normalizeDns = (value, label) => {
    const normalized = String(value).trim().toLowerCase().replace(/\.$/, "")
    if (normalized.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
        fail(`--${label} must be a DNS name`)
    }
    return normalized
}

const tunnelRecordFor = (tunnel) => `cloudflare-${tunnel.toLowerCase().replaceAll("_", "-")}-tunnel-token.key.enc`

const SENSITIVE_PORTS = new Set([21, 22, 23, 25, 110, 143, 445, 1433, 2375, 2376, 3306, 4222, 5432, 5672, 6379, 6333, 6334, 6443, 8222, 9001, 9092, 9200, 9300, 11211, 27017])
const SENSITIVE_HOST = /(?:^|[.-])(postgres|mysql|mariadb|mongo|redis|qdrant|kafka|nats|rabbitmq|elasticsearch|opensearch|database|db|minio-admin)(?:[.-]|$)/i

const validateService = (input) => {
    let url
    try { url = new URL(input) } catch { fail("--service must be an absolute http:// or https:// URL") }
    if (!new Set(["http:", "https:"]).has(url.protocol)) fail("raw TCP and non-HTTP tunnel services are refused")
    if (url.username || url.password) fail("--service must not contain credentials")
    if (url.search || url.hash) fail("--service must not contain query or fragment data")
    if (url.pathname !== "/") fail("--service must identify an origin, not an application path")
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80))
    if (SENSITIVE_PORTS.has(port) || SENSITIVE_HOST.test(url.hostname)) {
        fail("datastore and administration origins are private by default; an exact exposure policy is required before this helper can route one")
    }
    return url.toString().replace(/\/$/, "")
}

const readJson = (path, label) => {
    if (!existsSync(path)) fail(`${label} is missing: ${path}`)
    try { return JSON.parse(readFileSync(path, "utf8")) }
    catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}

const resolveContext = ({ project, role }) => {
    const routePath = join(sourceRoot, ".workspace", project, role, "config.json")
    const route = readJson(routePath, `${project}/${role} route`)
    if (route.project !== project || route.role !== role) fail(`${routePath} identifies ${route.project}/${route.role}`)
    const requestedRepo = resolve(route.repository?.diskPath ?? "")
    if (!existsSync(requestedRepo) || resolve(route.repository?.gitRoot ?? "") !== requestedRepo) fail(`${project}/${role} route has no verified checkout`)

    const identity = join(homedir(), ".starci", "master.identity")
    if (!existsSync(identity)) fail(`initialization identity is absent at ${identity}; restore it through starci-init before publishing credentials`)
    const identityPreflight = spawnSync(process.execPath, [join(trustRoot, "scripts", "init-identity.mjs"), "--source", sourceRoot, "--plan"], {
        cwd: sourceRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
    })
    if (identityPreflight.error || identityPreflight.status !== 0 || !String(identityPreflight.stdout).includes("verdict: ready")) {
        fail("initialization identity preflight is not ready; run starci-init before publishing credentials")
    }
    return {
        routePath,
        requestedRepo,
        identity,
        credentialsRoot: join(sourceRoot, ".workspace", "credentials"),
    }
}

const readHidden = (prompt) => new Promise((resolveValue) => {
    if (!process.stdin.isTTY) fail("CLOUDFLARE_API_TOKEN is absent and no interactive terminal is available")
    const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    const write = terminal._writeToOutput.bind(terminal)
    terminal._writeToOutput = (text) => { if (!muted || text.includes(prompt)) write(text) }
    terminal.question(prompt, (answer) => {
        terminal.close()
        process.stdout.write("\n")
        resolveValue(answer)
    })
    muted = true
})

const resolveCommand = (name) => {
    const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""]
    for (const directory of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
        for (const extension of extensions) {
            const candidate = join(directory, `${name}${extension}`)
            if (existsSync(candidate)) return candidate
        }
    }
    fail(`${name} is not installed or is absent from PATH`)
}

const storeCredential = (context, record, value) => {
    mkdirSync(context.credentialsRoot, { recursive: true })
    const temporary = join(context.credentialsRoot, `.credential-${randomUUID()}.tmp`)
    const encrypted = join(context.credentialsRoot, record)
    const ageKeygen = resolveCommand("age-keygen")
    const sops = resolveCommand("sops")
    const recipientResult = spawnSync(ageKeygen, ["-y", context.identity], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
    const recipient = String(recipientResult.stdout ?? "").trim()
    if (recipientResult.status !== 0 || !recipient.startsWith("age1")) fail("initialization identity has no valid age recipient")
    try {
        writeFileSync(temporary, value, { mode: 0o600 })
        try { chmodSync(temporary, 0o600) } catch { /* Windows ACL is inherited from the user profile. */ }
        const emptyConfig = process.platform === "win32" ? "NUL" : "/dev/null"
        const encryption = spawnSync(sops, ["--encrypt", "--config", emptyConfig, "--input-type", "binary", "--output-type", "binary", "--age", recipient, "--output", encrypted, temporary], {
            encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
        })
        if (encryption.status !== 0) {
            const reason = String(encryption.stderr ?? "").trim().split(/\r?\n/)[0]
            fail(`could not encrypt workspace credential ${record}${reason ? `: ${reason}` : ""}`)
        }
        const verification = spawnSync(sops, ["--decrypt", "--input-type", "binary", "--output-type", "binary", encrypted], {
            encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
            env: { ...process.env, SOPS_AGE_KEY_FILE: context.identity },
        })
        if (verification.status !== 0 || String(verification.stdout) !== value) fail(`workspace credential verification failed for ${record}`)
    } finally {
        rmSync(temporary, { force: true })
    }
}

const loadCredential = (context, record) => {
    const encrypted = join(context.credentialsRoot, record)
    if (!existsSync(encrypted)) return null
    const sops = resolveCommand("sops")
    const result = spawnSync(sops, ["--decrypt", "--input-type", "binary", "--output-type", "binary", encrypted], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: { ...process.env, SOPS_AGE_KEY_FILE: context.identity },
    })
    if (result.status !== 0) fail(`could not decrypt workspace credential ${record}`)
    const value = String(result.stdout ?? "").trim()
    if (!value) fail(`workspace credential ${record} decrypted empty`)
    return value
}

const createApi = (token, fetchImpl = fetch) => async (path, options = {}) => {
    const response = await fetchImpl(`${API_ROOT}${path}`, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    })
    let envelope
    try { envelope = await response.json() } catch { fail(`Cloudflare returned a non-JSON response (${response.status})`) }
    if (!response.ok || envelope.success !== true) {
        const codes = Array.isArray(envelope.errors) ? envelope.errors.map((item) => item.code).filter(Boolean).join(",") : "unknown"
        fail(`Cloudflare API request failed (${response.status}; codes ${codes})`)
    }
    return envelope.result
}

const stable = (value) => JSON.stringify(value)
const mergeIngress = (current, hostname, service) => {
    const entries = Array.isArray(current) ? current : []
    const matches = entries.filter((entry) => entry?.hostname === hostname)
    if (matches.length > 1) fail(`tunnel configuration contains duplicate ingress for ${hostname}`)
    const catchalls = entries.filter((entry) => String(entry?.service ?? "").startsWith("http_status:"))
    const kept = entries.filter((entry) => entry?.hostname !== hostname && !String(entry?.service ?? "").startsWith("http_status:"))
    return [...kept, { ...(matches[0] ?? {}), hostname, service }, { ...(catchalls.at(-1) ?? {}), service: "http_status:404" }]
}

const reconcile = async (input, api) => {
    const zones = await api(`/zones?name=${encodeURIComponent(input.zone)}&status=active`)
    if (!Array.isArray(zones) || zones.length !== 1) fail(`expected one active Cloudflare zone named ${input.zone}`)
    const zone = zones[0]
    const accountId = zone.account?.id
    if (!accountId) fail("the resolved zone has no Cloudflare account identity")

    let tunnels = await api(`/accounts/${accountId}/cfd_tunnel?name=${encodeURIComponent(input.tunnel)}&is_deleted=false`)
    if (!Array.isArray(tunnels) || tunnels.length > 1) fail(`expected at most one live tunnel named ${input.tunnel}`)
    let tunnel = tunnels[0]
    let tunnelChange = "reused"
    if (!tunnel) {
        tunnel = await api(`/accounts/${accountId}/cfd_tunnel`, { method: "POST", body: stable({ name: input.tunnel, config_src: "cloudflare" }) })
        tunnelChange = "created"
    }
    if (!tunnel?.id || tunnel.config_src !== "cloudflare") fail("the named tunnel is not remotely managed by Cloudflare")

    const existingConfiguration = await api(`/accounts/${accountId}/cfd_tunnel/${tunnel.id}/configurations`)
    const currentConfig = existingConfiguration?.config ?? {}
    const ingress = mergeIngress(currentConfig.ingress, input.hostname, input.service)
    const nextConfig = { ...currentConfig, ingress }
    let ingressChange = "unchanged"
    if (stable(currentConfig) !== stable(nextConfig)) {
        await api(`/accounts/${accountId}/cfd_tunnel/${tunnel.id}/configurations`, { method: "PUT", body: stable({ config: nextConfig }) })
        ingressChange = "updated"
    }

    const records = await api(`/zones/${zone.id}/dns_records?name=${encodeURIComponent(input.hostname)}`)
    if (!Array.isArray(records) || records.length > 1) fail(`expected at most one DNS record at ${input.hostname}`)
    const desiredDns = { type: "CNAME", name: input.hostname, content: `${tunnel.id}.cfargotunnel.com`, proxied: true, ttl: 1 }
    let dnsChange = "unchanged"
    if (!records[0]) {
        await api(`/zones/${zone.id}/dns_records`, { method: "POST", body: stable(desiredDns) })
        dnsChange = "created"
    } else {
        const record = records[0]
        if (record.type !== "CNAME") fail(`${input.hostname} already has a non-CNAME DNS record; refusing replacement`)
        if (record.content !== desiredDns.content || record.proxied !== true) {
            await api(`/zones/${zone.id}/dns_records/${record.id}`, { method: "PATCH", body: stable(desiredDns) })
            dnsChange = "updated"
        }
    }
    const tunnelToken = await api(`/accounts/${accountId}/cfd_tunnel/${tunnel.id}/token`)
    if (typeof tunnelToken !== "string" || tunnelToken.length < 16) fail("Cloudflare returned no usable tunnel run token")
    return { tunnelChange, ingressChange, dnsChange, tunnelToken }
}

const selfTest = async () => {
    assert.equal(validateService("http://sonarqube:9000"), "http://sonarqube:9000")
    assert.throws(() => validateService("tcp://localhost:5432"), /raw TCP/)
    assert.throws(() => validateService("http://localhost:6333"), /datastore/)
    assert.deepEqual(mergeIngress([{ hostname: "old.example.com", service: "http://old:80" }, { service: "http_status:404" }], "new.example.com", "http://app:8080"), [
        { hostname: "old.example.com", service: "http://old:80" },
        { hostname: "new.example.com", service: "http://app:8080" },
        { service: "http_status:404" },
    ])
    assert.deepEqual(mergeIngress([{ hostname: "new.example.com", service: "http://old:80", originRequest: { noTLSVerify: true } }, { service: "http_status:404" }], "new.example.com", "https://app:8443"), [
        { hostname: "new.example.com", service: "https://app:8443", originRequest: { noTLSVerify: true } },
        { service: "http_status:404" },
    ])
    let called = false
    const api = createApi("not-a-real-token", async () => { called = true; return { ok: true, status: 200, json: async () => ({ success: true, result: [] }) } })
    assert.deepEqual(await api("/mock"), [])
    assert.equal(called, true)
    const mutationCalls = []
    const fakeApi = async (path, options = {}) => {
        if (options.method) mutationCalls.push([path, options.method])
        if (path.startsWith("/zones?")) return [{ id: "zone-id", account: { id: "account-id" } }]
        if (path.includes("/cfd_tunnel?") ) return [{ id: "tunnel-id", config_src: "cloudflare" }]
        if (path.endsWith("/configurations")) return { config: { ingress: [{ hostname: "new.example.com", service: "http://app:8080" }, { service: "http_status:404" }] } }
        if (path.includes("/dns_records?")) return [{ id: "dns-id", type: "CNAME", content: "tunnel-id.cfargotunnel.com", proxied: true }]
        if (path.endsWith("/token")) return "mock-tunnel-token-value"
        fail(`unexpected self-test API path: ${path}`)
    }
    const reconciled = await reconcile({ zone: "example.com", hostname: "new.example.com", service: "http://app:8080", tunnel: "test-tunnel" }, fakeApi)
    assert.deepEqual({ ...reconciled, tunnelToken: "redacted" }, { tunnelChange: "reused", ingressChange: "unchanged", dnsChange: "unchanged", tunnelToken: "redacted" })
    assert.deepEqual(mutationCalls, [])
    console.log("cloudflare-tunnel-set self-test: pass (mock transport; no external calls)")
}

const main = async () => {
    const input = parseArgs(process.argv.slice(2))
    if (input.selfTest) return selfTest()
    const context = resolveContext(input)
    const tunnelRecord = tunnelRecordFor(input.tunnel)
    console.log(`route: ${input.project}/${input.role} -> ${context.requestedRepo}`)
    console.log(`identity: ${context.identity} (present; value never read)`)
    console.log(`origin: ${input.service}`)
    console.log(`public route: https://${input.hostname} through ${input.tunnel}`)
    console.log(`encrypted records: .workspace/credentials/${API_RECORD}, .workspace/credentials/${tunnelRecord}`)
    console.log("external state: remotely managed tunnel ingress and proxied CNAME")
    console.log("credential output: never")
    if (input.plan) return

    let apiToken = process.env.CLOUDFLARE_API_TOKEN ?? loadCredential(context, API_RECORD)
    if (!apiToken) apiToken = await readHidden("value for CLOUDFLARE_API_TOKEN (hidden): ")
    if (!apiToken || !apiToken.trim()) fail("empty CLOUDFLARE_API_TOKEN; nothing was changed")
    try {
        storeCredential(context, API_RECORD, apiToken)
        const result = await reconcile(input, createApi(apiToken))
        storeCredential(context, tunnelRecord, result.tunnelToken)
        result.tunnelToken = ""
        console.log(`tunnel: ${result.tunnelChange}`)
        console.log(`ingress: ${result.ingressChange}`)
        console.log(`dns: ${result.dnsChange}`)
        console.log("tunnel run token: encrypted; value never printed")
    } finally {
        apiToken = ""
        delete process.env.CLOUDFLARE_API_TOKEN
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : "cloudflare-tunnel-set: failed")
    process.exit(1)
})
