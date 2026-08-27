#!/usr/bin/env node

import {
    closeSync,
    existsSync,
    mkdirSync,
    openSync,
    readFileSync,
    unlinkSync,
    writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import {
    dirname,
    join,
    relative,
    resolve,
    sep,
} from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SOURCE_ROOT = resolve(SCRIPT_DIR,
    "../..")
const MASTER_IDENTITY = join(homedir(),
    ".starci",
    "master.identity")
const SONAR_ORIGIN = "https://sonar.starci.org"

const die = (message) => {
    console.error(`sonar-credential: ${message}`)
    process.exit(1)
}

const parseOptions = (args) => {
    const options = {}
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index]
        if (!arg.startsWith("--")) {
            continue
        }
        const key = arg.slice(2)
        const value = args[index + 1]
        if (!value || value.startsWith("--")) {
            die(`${arg} needs a value`)
        }
        options[key] = value
        index += 1
    }
    return options
}

const safeProjectPart = (value, label) => {
    if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
        die(`${label} must use lowercase letters, numbers, and hyphens`)
    }
    return value
}

const run = (command, args, options = {}) => {
    const executable = process.platform === "win32" && command === "npm"
        ? "npm.cmd"
        : process.platform === "win32" && command === "gh"
            ? "gh.exe"
            : command
    const result = spawnSync(executable,
        args,
        {
            cwd: options.cwd ?? SOURCE_ROOT,
            encoding: "utf8",
            env: options.env ?? process.env,
            input: options.input,
            maxBuffer: 32 * 1024 * 1024,
            shell: process.platform === "win32" && command === "npm",
            stdio: options.inherit
                ? "inherit"
                : ["pipe", "pipe", "pipe"],
        })
    if (result.error) {
        die(`${command} could not start: ${result.error.message}`)
    }
    if (result.status !== 0) {
        const detail = (result.stderr || "").trim().split(/\r?\n/).slice(-3).join(" | ")
        die(`${command} failed with status ${result.status}${detail ? `: ${detail}` : ""}`)
    }
    return result.stdout ?? ""
}

const routeFor = (project, role, options = {}) => {
    const routePath = join(SOURCE_ROOT,
        ".workspaces",
        "local",
        "routes",
        project,
        role,
        "config.json")
    if (!existsSync(routePath)) {
        die(`hydrated route is missing for ${project}/${role}`)
    }
    const route = JSON.parse(readFileSync(routePath,
        "utf8"))
    if (route.project !== project || route.role !== role) {
        die(`hydrated route identity does not match ${project}/${role}`)
    }
    const checkout = route.repository?.gitRoot
    if (typeof checkout !== "string" || !existsSync(checkout)) {
        die(`verified checkout is unavailable for ${project}/${role}`)
    }
    const observedBranch = run("git",
        ["branch", "--show-current"],
        {
            cwd: checkout
        }).trim()
    const observedOrigin = run("git",
        ["remote", "get-url", "origin"],
        {
            cwd: checkout
        }).trim()
    const requireDeclaredBranch = options.requireDeclaredBranch !== false
    if ((requireDeclaredBranch && observedBranch !== route.repository.branch) || observedOrigin !== route.repository.gitRepository) {
        die(`checkout identity drifted for ${project}/${role}`)
    }
    const propertiesPath = join(checkout,
        "sonar-project.properties")
    if (!existsSync(propertiesPath)) {
        die(`sonar-project.properties is missing for ${project}/${role}`)
    }
    const projectKey = readFileSync(propertiesPath,
        "utf8").match(/^sonar\.projectKey=(.+)$/m)?.[1]?.trim()
    const projectName = readFileSync(propertiesPath,
        "utf8").match(/^sonar\.projectName=(.+)$/m)?.[1]?.trim()
    if (!projectKey) {
        die(`sonar.projectKey is missing for ${project}/${role}`)
    }
    return {
        checkout,
        origin: observedOrigin,
        projectKey,
        projectName: projectName || projectKey,
    }
}

const cipherFor = (project, role) => join(SOURCE_ROOT,
    ".stacks",
    "dev",
    "runtime",
    "files",
    `sonarqube-${project}-${role}-token.key.enc`)

const decryptBinary = (cipherPath) => {
    if (!existsSync(MASTER_IDENTITY)) {
        die(`master identity is missing at ${MASTER_IDENTITY}`)
    }
    if (!existsSync(cipherPath)) {
        die(`encrypted credential is missing: ${relative(SOURCE_ROOT,
            cipherPath).split(sep).join("/")}`)
    }
    const value = run("sops",
        ["--decrypt", "--input-type", "binary", "--output-type", "binary", cipherPath],
        {
            env: {
                ...process.env,
                SOPS_AGE_KEY_FILE: MASTER_IDENTITY,
            },
        }).trim()
    if (!value) {
        die("decrypted credential is empty")
    }
    return value
}

const githubRepository = (origin) => {
    const httpsMatch = origin.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)
    const sshMatch = origin.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/)
    const repository = httpsMatch?.[1] ?? sshMatch?.[1]
    if (!repository) {
        die("the verified origin is not a supported GitHub repository")
    }
    return repository
}

const sonarRequest = async (path, authHeader, options = {}) => {
    const response = await fetch(`${SONAR_ORIGIN}${path}`,
        {
            method: options.method ?? "GET",
            headers: {
                Authorization: authHeader,
                ...(options.body
                    ? { "Content-Type": "application/x-www-form-urlencoded" }
                    : {}),
            },
            body: options.body,
        })
    if (!response.ok) {
        die(`Sonar API ${path} returned HTTP ${response.status}`)
    }
    return response.json()
}

const writeHandle = (project, role, route, cipherPath) => {
    const handlePath = join(SOURCE_ROOT,
        ".worktrees",
        "credentials",
        project,
        role,
        "sonar.json")
    mkdirSync(dirname(handlePath),
        {
            recursive: true
        })
    writeFileSync(handlePath,
        `${JSON.stringify({
            schemaVersion: 1,
            project,
            role,
            sonarProjectKey: route.projectKey,
            encryptedCredential: relative(SOURCE_ROOT,
                cipherPath).split(sep).join("/"),
        }, null, 2)}\n`,
        "utf8")
    return relative(SOURCE_ROOT,
        handlePath).split(sep).join("/")
}

const acquireRunLock = (project, role) => {
    const lockPath = join(SOURCE_ROOT,
        ".worktrees",
        "credentials",
        project,
        role,
        "sonar-run.lock")
    mkdirSync(dirname(lockPath),
        {
            recursive: true
        })
    let descriptor
    try {
        descriptor = openSync(lockPath,
            "wx")
    } catch (error_) {
        if (error_?.code !== "EEXIST") {
            throw error_
        }
        const owner = Number.parseInt(readFileSync(lockPath,
            "utf8").trim(),
        10)
        if (!Number.isSafeInteger(owner) || owner <= 0) {
            die(`a Sonar run lock is already being acquired for ${project}/${role}`)
        }
        let ownerIsActive = true
        try {
            process.kill(owner,
                0)
        } catch (probeError) {
            ownerIsActive = probeError?.code !== "ESRCH"
        }
        if (ownerIsActive) {
            die(`a Sonar run is already active for ${project}/${role} (pid ${owner})`)
        }
        unlinkSync(lockPath)
        descriptor = openSync(lockPath,
            "wx")
    }
    writeFileSync(descriptor,
        `${process.pid}\n`,
        "utf8")
    let released = false
    const release = () => {
        if (released) return
        released = true
        closeSync(descriptor)
        if (existsSync(lockPath) && readFileSync(lockPath,
            "utf8").trim() === String(process.pid)) {
            unlinkSync(lockPath)
        }
    }
    process.once("exit",
        release)
    return release
}

const scannerWorkingDirectory = (project, role) => [
    ".worktrees",
    "credentials",
    project,
    role,
    "scannerwork",
].join("/")

const rotate = async (project, role) => {
    const route = routeFor(project,
        role,
        {
            requireDeclaredBranch: false,
        })
    const adminCipher = join(SOURCE_ROOT,
        ".stacks",
        "dev",
        "runtime",
        "files",
        "sonarqube-admin-password.txt.enc")
    const adminPassword = decryptBinary(adminCipher)
    const adminAuth = `Basic ${Buffer.from(`admin:${adminPassword}`,
        "utf8").toString("base64")}`
    const tokenName = `${project}-${role}-local-analysis`
    const projects = await sonarRequest(`/api/projects/search?q=${encodeURIComponent(route.projectKey)}&ps=100`,
        adminAuth)
    if (!projects.components?.some((candidate) => candidate.key === route.projectKey)) {
        await sonarRequest("/api/projects/create",
            adminAuth,
            {
                method: "POST",
                body: new URLSearchParams({
                    project: route.projectKey,
                    name: route.projectName,
                }),
            })
    }
    const current = await sonarRequest("/api/user_tokens/search",
        adminAuth)
    if (current.userTokens?.some((token) => token.name === tokenName)) {
        await sonarRequest("/api/user_tokens/revoke",
            adminAuth,
            {
                method: "POST",
                body: new URLSearchParams({
                    name: tokenName
                }),
            })
    }
    const generated = await sonarRequest("/api/user_tokens/generate",
        adminAuth,
        {
            method: "POST",
            body: new URLSearchParams({
                name: tokenName,
                type: "PROJECT_ANALYSIS_TOKEN",
                projectKey: route.projectKey,
            }),
        })
    const token = generated.token
    if (typeof token !== "string" || token.trim() === "") {
        die("Sonar returned an empty generated token")
    }
    const cipherPath = cipherFor(project,
        role)
    const stackTarget = relative(join(SOURCE_ROOT,
        ".stacks"),
    cipherPath.replace(/\.enc$/,
        "")).split(sep).join("/")
    run(process.execPath,
        [join(SOURCE_ROOT,
            "scripts",
            "stack-secret.mjs"), "set", stackTarget],
        {
            input: token
        })
    run("gh",
        ["secret", "set", "SONAR_TOKEN", "--repo", githubRepository(route.origin)],
        {
            input: token
        })
    const validation = await sonarRequest("/api/authentication/validate",
        `Bearer ${token}`)
    if (validation.valid !== true) {
        die("the newly generated token did not validate")
    }
    const handle = writeHandle(project,
        role,
        route,
        cipherPath)
    console.log(JSON.stringify({
        project,
        role,
        sonarProjectKey: route.projectKey,
        encrypted: true,
        githubSecretUpdated: true,
        credentialHandle: handle,
    }))
}

const runGate = async (project, role) => {
    const releaseRunLock = acquireRunLock(project,
        role)
    const route = routeFor(project,
        role)
    const cipherPath = cipherFor(project,
        role)
    const token = decryptBinary(cipherPath)
    const validation = await sonarRequest("/api/authentication/validate",
        `Bearer ${token}`)
    if (validation.valid !== true) {
        die(`encrypted credential is not valid for ${project}/${role}`)
    }
    writeHandle(project,
        role,
        route,
        cipherPath)
    try {
        run("npm",
            ["run",
                "sonar:check",
                "--",
                `-Dsonar.working.directory=${scannerWorkingDirectory(project,
                    role)}`],
            {
                cwd: route.checkout,
                env: {
                    ...process.env,
                    SONAR_TOKEN: token,
                },
                inherit: true,
            })
    } finally {
        releaseRunLock()
    }
}

const readStatus = async (project, role) => {
    const route = routeFor(project,
        role)
    const cipherPath = cipherFor(project,
        role)
    const token = decryptBinary(cipherPath)
    const authHeader = `Bearer ${token}`
    const validation = await sonarRequest("/api/authentication/validate",
        authHeader)
    if (validation.valid !== true) {
        die(`encrypted credential is not valid for ${project}/${role}`)
    }
    const reportPath = join(route.checkout,
        scannerWorkingDirectory(project,
            role),
        "report-task.txt")
    if (!existsSync(reportPath)) {
        die(`Sonar report-task is missing for ${project}/${role}`)
    }
    const report = readFileSync(reportPath,
        "utf8")
    const taskId = report.match(/^ceTaskId=(.+)$/m)?.[1]?.trim()
    if (!taskId) {
        die(`Sonar report-task has no compute-engine task for ${project}/${role}`)
    }
    const computeEngine = await sonarRequest(`/api/ce/task?id=${encodeURIComponent(taskId)}`,
        authHeader)
    const computeEngineStatus = computeEngine.task?.status
    const analysisId = computeEngine.task?.analysisId
    let qualityGateStatus = null
    let failingConditions = []
    let newIssueTotal = 0
    let newIssues = []
    if (computeEngineStatus === "SUCCESS" && typeof analysisId === "string") {
        const qualityGate = await sonarRequest(`/api/qualitygates/project_status?analysisId=${encodeURIComponent(analysisId)}`,
            authHeader)
        qualityGateStatus = qualityGate.projectStatus?.status ?? null
        failingConditions = (qualityGate.projectStatus?.conditions ?? [])
            .filter((condition) => condition.status === "ERROR")
            .map((condition) => ({
                metricKey: condition.metricKey,
                comparator: condition.comparator,
                errorThreshold: condition.errorThreshold,
                actualValue: condition.actualValue,
            }))
        if (qualityGateStatus === "ERROR") {
            const issues = await sonarRequest(`/api/issues/search?componentKeys=${encodeURIComponent(route.projectKey)}&resolved=false&inNewCodePeriod=true&ps=100`,
                authHeader)
            newIssueTotal = issues.total ?? 0
            newIssues = (issues.issues ?? []).map((issue) => ({
                component: issue.component?.replace(`${route.projectKey}:`,
                    ""),
                line: issue.line ?? null,
                rule: issue.rule,
                message: issue.message,
            }))
        }
    }
    console.log(JSON.stringify({
        project,
        role,
        sonarProjectKey: route.projectKey,
        computeEngineStatus,
        qualityGateStatus,
        failingConditions,
        newIssueTotal,
        newIssues,
    }))
}

const readLatestStatus = async (project, role) => {
    const route = routeFor(project,
        role,
        {
            requireDeclaredBranch: false,
        })
    const token = decryptBinary(cipherFor(project,
        role))
    const authHeader = `Bearer ${token}`
    const validation = await sonarRequest("/api/authentication/validate",
        authHeader)
    if (validation.valid !== true) {
        die(`encrypted credential is not valid for ${project}/${role}`)
    }
    const qualityGate = await sonarRequest(`/api/qualitygates/project_status?projectKey=${encodeURIComponent(route.projectKey)}`,
        authHeader)
    const qualityGateStatus = qualityGate.projectStatus?.status ?? null
    const failingConditions = (qualityGate.projectStatus?.conditions ?? [])
        .filter((condition) => condition.status === "ERROR")
        .map((condition) => ({
            metricKey: condition.metricKey,
            comparator: condition.comparator,
            errorThreshold: condition.errorThreshold,
            actualValue: condition.actualValue,
        }))
    let newIssueTotal = 0
    let newIssues = []
    if (qualityGateStatus === "ERROR") {
        const issues = await sonarRequest(`/api/issues/search?componentKeys=${encodeURIComponent(route.projectKey)}&resolved=false&inNewCodePeriod=true&ps=100`,
            authHeader)
        newIssueTotal = issues.total ?? 0
        newIssues = (issues.issues ?? []).map((issue) => ({
            component: issue.component?.replace(`${route.projectKey}:`,
                ""),
            line: issue.line ?? null,
            rule: issue.rule,
            message: issue.message,
        }))
    }
    console.log(JSON.stringify({
        project,
        role,
        sonarProjectKey: route.projectKey,
        qualityGateStatus,
        failingConditions,
        newIssueTotal,
        newIssues,
    }))
}

const HELP = `
Secure Sonar credential bridge

  node .claude/scripts/sonar-credential.mjs rotate --project <project> --role <role>
  node .claude/scripts/sonar-credential.mjs run    --project <project> --role <role>
  node .claude/scripts/sonar-credential.mjs status --project <project> --role <role>
  node .claude/scripts/sonar-credential.mjs latest --project <project> --role <role>

Ciphertext is tracked under .stacks/dev/runtime/files. A value-safe local handle
is hydrated under .worktrees/credentials. Plaintext is never printed or committed.
`

const main = async () => {
    const [command, ...args] = process.argv.slice(2)
    if (!command || command === "help" || command === "--help" || command === "-h") {
        console.log(HELP.trim())
        return
    }
    const options = parseOptions(args)
    const project = safeProjectPart(options.project,
        "--project")
    const role = safeProjectPart(options.role,
        "--role")
    if (command === "rotate") {
        await rotate(project,
            role)
        return
    }
    if (command === "run") {
        await runGate(project,
            role)
        return
    }
    if (command === "status") {
        await readStatus(project,
            role)
        return
    }
    if (command === "latest") {
        await readLatestStatus(project,
            role)
        return
    }
    die(`unknown command: ${command}`)
}

main()
