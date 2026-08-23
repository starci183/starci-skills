#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { delimiter, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { reconcileGateOnly } from "./sonar-quality-gate.mjs"

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const defaultSourceRoot = resolve(trustRoot, "..")

const fail = (message) => { throw new Error(`sonar-source-credentials: ${message}`) }

const parseArgs = (args) => {
    const allowed = new Set(["--source", "--host", "--execute", "--rotate", "--plan", "--check-authority", "--badges-only"])
    const values = { sourceRoot: defaultSourceRoot, host: "https://sonar.starci.org", execute: false, rotate: false, checkAuthority: false, badgesOnly: false }
    for (let index = 0; index < args.length; index += 1) {
        const item = args[index]
        if (!allowed.has(item)) fail(`unknown argument ${item}; credentials are stdin-only`)
        if (item === "--execute") values.execute = true
        else if (item === "--rotate") values.rotate = true
        else if (item === "--plan") values.execute = false
        else if (item === "--check-authority") values.checkAuthority = true
        else if (item === "--badges-only") values.badgesOnly = true
        else {
            const value = args[index + 1]
            if (!value || value.startsWith("--")) fail(`${item} needs a value`)
            if (item === "--source") values.sourceRoot = resolve(value)
            if (item === "--host") values.host = new URL(value).origin
            index += 1
        }
    }
    if (!values.host.startsWith("https://")) fail("--host must use HTTPS")
    return values
}

const readJson = (path, label) => {
    if (!existsSync(path)) fail(`${label} is missing: ${path}`)
    try { return JSON.parse(readFileSync(path, "utf8")) }
    catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}

const gitHubRepo = (repo) => {
    const origin = execFileSync("git", ["-C", repo, "remote", "get-url", "origin"], { encoding: "utf8", windowsHide: true }).trim()
    const match = origin.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i)
    if (!match) fail(`cannot resolve GitHub repository for ${repo}`)
    return `${match[1]}/${match[2]}`
}

const assertSafeReadmeWrites = (rows) => {
    for (const row of rows) {
        const conflicts = execFileSync("git", ["-C", row.repo, "diff", "--name-only", "--diff-filter=U"], { encoding: "utf8", windowsHide: true }).trim()
        if (conflicts) fail(`${row.project}/${row.role} repository has unresolved conflicts`)
    }
}

export const inventorySonarRoutes = (sourceRoot) => {
    const workspace = join(sourceRoot, ".workspaces", "local", "routes")
    if (!existsSync(workspace)) fail(`workspace is missing: ${workspace}`)
    const rows = []
    for (const projectEntry of readdirSync(workspace, { withFileTypes: true })) {
        if (!projectEntry.isDirectory()) continue
        for (const role of ["be", "fe"]) {
            const routePath = join(workspace, projectEntry.name, role, "config.json")
            if (!existsSync(routePath)) continue
            const route = readJson(routePath, `${projectEntry.name}/${role} route`)
            const repo = resolve(route.repository?.diskPath ?? "")
            if (!existsSync(repo) || resolve(route.repository?.gitRoot ?? "") !== repo) fail(`${projectEntry.name}/${role} route is stale`)
            const properties = join(repo, "sonar-project.properties")
            if (!existsSync(properties)) fail(`${projectEntry.name}/${role} has no sonar-project.properties`)
            const key = readFileSync(properties, "utf8").match(/^sonar\.projectKey=(.+)$/m)?.[1]?.trim()
            if (!key) fail(`${properties} has no sonar.projectKey`)
            const manifest = readJson(join(repo, "package.json"), `${projectEntry.name}/${role} manifest`)
            const secretSetter = String(manifest.scripts?.["secret:set"] ?? "")
            const ownsStack = role === "be" && /stack-secret\.mjs\s+set/.test(secretSetter)
            const stackOwner = ownsStack ? repo : sourceRoot
            const record = ownsStack
                ? "dev/runtime/files/sonarqube-token.key"
                : `dev/runtime/files/sonarqube-${key.replace(/[^a-zA-Z0-9_.-]/g, "-")}-token.key`
            rows.push({ project: projectEntry.name, role, repo, key, github: gitHubRepo(repo), stackOwner, record })
        }
    }
    if (rows.length === 0) fail("no routed backend/frontend Sonar projects were found")
    const duplicates = rows.filter((row, index) => rows.findIndex((other) => other.key === row.key) !== index)
    if (duplicates.length) fail(`duplicate Sonar project key: ${duplicates[0].key}`)
    return rows.sort((a, b) => `${a.project}/${a.role}`.localeCompare(`${b.project}/${b.role}`))
}

const stdinJson = async () => {
    let input = ""
    for await (const chunk of process.stdin) input += chunk
    try { return JSON.parse(input) }
    catch { fail("execute mode requires one JSON credential envelope on stdin") }
}

const authHeader = (login, secret) => `Basic ${Buffer.from(`${login}:${secret}`).toString("base64")}`

const sonarBadgeMetrics = [
    ["Quality Gate", "alert_status"],
    ["Coverage", "coverage"],
    ["Bugs", "bugs"],
    ["Vulnerabilities", "vulnerabilities"],
    ["Code Smells", "code_smells"],
    ["Maintainability", "sqale_rating"],
    ["Reliability", "reliability_rating"],
    ["Security", "security_rating"],
]

export const reconcileSonarBadgeMarkdown = (markdown, { host, projectKey, badgeToken }) => {
    if (!String(badgeToken ?? "").trim()) fail("project badge token is absent")
    const origin = new URL(host).origin
    const newline = markdown.includes("\r\n") ? "\r\n" : "\n"
    const dashboard = `${origin}/dashboard?id=${encodeURIComponent(projectKey)}`
    const block = sonarBadgeMetrics.map(([label, metric]) => {
        const image = `${origin}/api/project_badges/measure?project=${encodeURIComponent(projectKey)}&metric=${metric}&token=${encodeURIComponent(badgeToken)}`
        return `[![SonarQube ${label}](${image})](${dashboard})`
    }).join(newline)
    const withoutExisting = markdown
        .split(/\r?\n/)
        .filter((line) => !/!\[[^\]]*\]\(https?:\/\/[^\s)]+\/api\/project_badges\/measure\?/i.test(line))
        .join(newline)
    const lines = withoutExisting.split(newline)
    const codecovIndex = lines.findIndex((line) => /!\[[^\]]*codecov[^\]]*\]\(/i.test(line))
    const headingIndex = lines.findIndex((line) => /^#\s+/.test(line))
    const insertAfter = codecovIndex >= 0 ? codecovIndex : headingIndex
    if (insertAfter < 0) fail("README has no heading or Codecov badge insertion point")
    lines.splice(insertAfter + 1, 0, ...block.split(newline))
    return lines.join(newline)
}

const reconcileReadmeBadges = ({ repo, host, projectKey, badgeToken }) => {
    const readme = ["README.md", "README.MD", "readme.md"].map((name) => join(repo, name)).find(existsSync)
    if (!readme) fail(`README is absent in ${repo}`)
    const before = readFileSync(readme, "utf8")
    const after = reconcileSonarBadgeMarkdown(before, { host, projectKey, badgeToken })
    if (after === before) return "current"
    const readmeRelative = relative(repo, readme)
    const status = execFileSync("git", ["-C", repo, "status", "--porcelain", "--", readmeRelative], { encoding: "utf8", windowsHide: true }).trim()
    const contentDiff = spawnSync("git", ["-C", repo, "diff", "--quiet", "--", readmeRelative], { windowsHide: true })
    if (status && contentDiff.status !== 0) fail(`${projectKey} README has unrelated uncommitted content; separate it before badge reconciliation`)
    writeFileSync(readme, after, "utf8")
    return "updated"
}

const reconcileAllReadmeBadges = async (rows, args, adminToken) => {
    const authorization = authHeader(adminToken, "")
    for (const row of rows) {
        const badge = await request({
            host: args.host,
            path: `/api/project_badges/token?project=${encodeURIComponent(row.key)}`,
            authorization,
        })
        const badgeToken = String(badge.token ?? "").trim()
        if (!badgeToken) fail(`Sonar did not return a badge token for ${row.key}`)
        const readmeBadges = reconcileReadmeBadges({ repo: row.repo, host: args.host, projectKey: row.key, badgeToken })
        console.log(JSON.stringify({ route: `${row.project}/${row.role}`, projectKey: row.key, badge: "read-only-project-scope", readmeBadges }))
    }
}

const request = async ({ host, path, method = "GET", authorization, body }) => {
    const headers = { authorization }
    const options = { method, headers, signal: AbortSignal.timeout(30_000) }
    if (body) {
        headers["content-type"] = "application/x-www-form-urlencoded"
        options.body = new URLSearchParams(Object.entries(body).filter(([, value]) => value !== undefined)).toString()
    }
    const response = await fetch(new URL(path, host), options)
    const raw = await response.text()
    let payload = {}
    if (raw.trim()) {
        try { payload = JSON.parse(raw) }
        catch { fail(`Sonar returned invalid JSON (${response.status})`) }
    }
    if (!response.ok) {
        const detail = (payload.errors ?? []).map((item) => item.msg ?? item.message).filter(Boolean).join("; ")
        fail(`Sonar API ${path} failed ${response.status}${detail ? ` (${detail})` : ""}`)
    }
    return payload
}

const resolveExecutable = (name) => {
    const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""]
    for (const directory of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
        for (const extension of extensions) {
            const candidate = join(directory, `${name}${extension}`)
            if (existsSync(candidate)) return candidate
        }
    }
    fail(`${name} is not installed or absent from PATH`)
}

const decryptRecord = (owner, record) => {
    const encrypted = join(owner, ".stacks", `${record}.enc`)
    if (!existsSync(encrypted)) return null
    const identity = join(homedir(), ".starci", "master.identity")
    if (!existsSync(identity)) fail(`SOPS identity is missing: ${identity}`)
    const result = spawnSync(resolveExecutable("sops"), ["--decrypt", "--input-type", "binary", "--output-type", "binary", encrypted], {
        encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
        env: { ...process.env, SOPS_AGE_KEY_FILE: identity },
    })
    if (result.status !== 0) fail(`cannot decrypt ${encrypted}`)
    return String(result.stdout ?? "").trim()
}

const publishSecret = ({ sourceRoot, name, value, stackOwner, record, github }) => {
    const publisher = join(sourceRoot, ".claude", "scripts", "publish-secret.mjs")
    const env = { ...process.env, [name]: value }
    const args = [publisher, "--name", name, "--from-env", name, "--stack", `${stackOwner}::${record}`]
    if (github) args.push("--repo", github)
    const result = spawnSync(process.execPath, args, { cwd: sourceRoot, encoding: "utf8", stdio: ["ignore", "inherit", "inherit"], windowsHide: true, env })
    env[name] = ""
    if (result.status !== 0) fail(`could not publish ${name} for ${github ?? record}`)
}

const setHostVariable = (github, host) => {
    const result = spawnSync(resolveExecutable("gh"), ["variable", "set", "SONAR_HOST_URL", "--repo", github, "--body", host], {
        encoding: "utf8", stdio: ["ignore", "inherit", "inherit"], windowsHide: true,
    })
    if (result.status !== 0) fail(`could not set SONAR_HOST_URL in ${github}`)
}

const validToken = async (host, token) => {
    if (!token) return false
    try {
        const result = await request({ host, path: "/api/authentication/validate", authorization: authHeader(token, "") })
        return result.valid === true
    } catch { return false }
}

const hasAdminAuthority = async (host, token) => {
    if (!(await validToken(host, token))) return false
    try {
        await request({ host, path: "/api/permissions/search_templates?ps=1", authorization: authHeader(token, "") })
        return true
    } catch { return false }
}

const issueToken = async ({ host, authorization, login, name, type, projectKey, rotate }) => {
    if (rotate) {
        try { await request({ host, path: "/api/user_tokens/revoke", method: "POST", authorization, body: { login, name } }) }
        catch (error) { if (!String(error.message).includes("not found")) throw error }
    }
    let result
    try {
        result = await request({
            host, path: "/api/user_tokens/generate", method: "POST", authorization,
            body: { login, name, type, projectKey },
        })
    } catch (error) {
        if (rotate || !/already exists/i.test(String(error.message))) throw error
        await request({ host, path: "/api/user_tokens/revoke", method: "POST", authorization, body: { login, name } })
        result = await request({
            host, path: "/api/user_tokens/generate", method: "POST", authorization,
            body: { login, name, type, projectKey },
        })
    }
    if (!result.token) fail(`Sonar did not return token ${name}`)
    return result.token
}

const execute = async (input, rows, args) => {
    assertSafeReadmeWrites(rows)
    const login = String(input.login ?? "").trim()
    let password = String(input.password ?? "")
    const adminRecord = "dev/runtime/files/sonarqube-admin-token.key"
    let adminToken = decryptRecord(args.sourceRoot, adminRecord)
    if (!(await hasAdminAuthority(args.host, adminToken))) {
        if (!login || !password) fail("stored admin authority is unavailable; operator login/password intake is required")
        const operatorAuthorization = authHeader(login, password)
        const validated = await request({ host: args.host, path: "/api/authentication/validate", authorization: operatorAuthorization })
        if (validated.valid !== true) fail("operator credential is invalid")
        if (adminToken && !args.rotate) fail("stored admin token lacks authority; rerun with -Rotate")
        adminToken = await issueToken({
            host: args.host, authorization: operatorAuthorization, login,
            name: "starci-source-admin", type: "USER_TOKEN", rotate: args.rotate,
        })
        publishSecret({ sourceRoot: args.sourceRoot, name: "SONAR_ADMIN_TOKEN", value: adminToken, stackOwner: args.sourceRoot, record: adminRecord })
    }
    password = ""

    for (const row of rows) {
        const adminAuthorization = authHeader(adminToken, "")
        const search = await request({ host: args.host, path: `/api/projects/search?projects=${encodeURIComponent(row.key)}`, authorization: adminAuthorization })
        if (!(search.components ?? []).some((component) => component.key === row.key)) {
            await request({ host: args.host, path: "/api/projects/create", method: "POST", authorization: adminAuthorization, body: { project: row.key, name: row.key } })
        }
        await reconcileGateOnly({ baseUrl: args.host, projectKey: row.key, token: adminToken })

        const badge = await request({
            host: args.host,
            path: `/api/project_badges/token?project=${encodeURIComponent(row.key)}`,
            authorization: adminAuthorization,
        })
        const badgeToken = String(badge.token ?? "").trim()
        if (!badgeToken) fail(`Sonar did not return a badge token for ${row.key}`)
        const readmeBadges = reconcileReadmeBadges({ repo: row.repo, host: args.host, projectKey: row.key, badgeToken })

        let analysisToken = decryptRecord(row.stackOwner, row.record)
        if (!(await validToken(args.host, analysisToken)) || args.rotate) {
            analysisToken = await issueToken({
                host: args.host, authorization: adminAuthorization, login,
                name: `starci-${row.key}-analysis`, type: "PROJECT_ANALYSIS_TOKEN",
                projectKey: row.key, rotate: args.rotate,
            })
        }
        publishSecret({ sourceRoot: args.sourceRoot, name: "SONAR_TOKEN", value: analysisToken, stackOwner: row.stackOwner, record: row.record, github: row.github })
        setHostVariable(row.github, args.host)
        analysisToken = ""
        console.log(JSON.stringify({ route: `${row.project}/${row.role}`, projectKey: row.key, identity: "project-analysis-token", badge: "read-only-project-scope", readmeBadges, gate: "starci-strict", projections: ["encrypted-stack", "github-secret", "github-variable"] }))
    }
    adminToken = ""
}

const main = async () => {
    const args = parseArgs(process.argv.slice(2))
    const rows = inventorySonarRoutes(args.sourceRoot)
    if (args.checkAuthority) {
        let token = decryptRecord(args.sourceRoot, "dev/runtime/files/sonarqube-admin-token.key")
        const available = await hasAdminAuthority(args.host, token)
        token = ""
        console.log(JSON.stringify({ authority: available ? "stored-admin-valid" : "operator-intake-required" }))
        if (!available) process.exitCode = 3
        return
    }
    if (args.badgesOnly) {
        let token = decryptRecord(args.sourceRoot, "dev/runtime/files/sonarqube-admin-token.key")
        if (!(await hasAdminAuthority(args.host, token))) fail("stored admin authority is unavailable; operator intake is required")
        assertSafeReadmeWrites(rows)
        await reconcileAllReadmeBadges(rows, args, token)
        token = ""
        return
    }
    for (const row of rows) console.log(JSON.stringify({ mode: args.execute ? "execute" : "plan", route: `${row.project}/${row.role}`, projectKey: row.key, github: row.github, stack: `${row.stackOwner}::${row.record}`, identity: "project-analysis-token", badge: "read-only-project-scope" }))
    if (!args.execute) return
    await execute(await stdinJson(), rows, args)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1) })
}
