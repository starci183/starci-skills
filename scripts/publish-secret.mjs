#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createInterface } from "node:readline"

const fail = (message) => {
    console.error(`publish-secret: ${message}`)
    process.exit(1)
}

const valuesFor = (args, flag) => {
    const values = []
    for (let index = 0; index < args.length; index += 1) {
        if (args[index] !== flag) continue
        const value = args[index + 1]
        if (!value || value.startsWith("--")) fail(`${flag} needs a value`)
        values.push(value)
        index += 1
    }
    return values
}

const valueFor = (args, flag) => valuesFor(args, flag).at(-1)

const readHidden = (prompt) => new Promise((resolveValue) => {
    if (!process.stdin.isTTY) {
        fail("no interactive terminal and the requested process environment variable is absent")
    }

    const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    const write = terminal._writeToOutput.bind(terminal)
    terminal._writeToOutput = (text) => {
        if (!muted || text.includes(prompt)) write(text)
    }
    terminal.question(prompt, (answer) => {
        terminal.close()
        process.stdout.write("\n")
        resolveValue(answer)
    })
    muted = true
})

const parseStack = (specification) => {
    const separator = specification.indexOf("::")
    if (separator < 1 || separator === specification.length - 2) {
        fail("--stack must be <project-directory>::<record-under-.stacks>")
    }
    const project = resolve(specification.slice(0, separator))
    const record = specification.slice(separator + 2)
    if (!existsSync(project)) fail(`stack project does not exist: ${project}`)
    if (record.startsWith(".") || record.startsWith("/") || record.startsWith("\\") || record.includes("..")) {
        fail(`stack record must stay below .stacks/: ${record}`)
    }

    const manifestPath = resolve(project, "package.json")
    if (!existsSync(manifestPath)) fail(`stack project has no package.json: ${project}`)
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    if (!String(manifest.scripts?.["secret:set"] ?? "").trim()) {
        fail(`stack project has no secret:set entrypoint: ${project}`)
    }
    return { project, record }
}

const runWithSecret = ({ command, args, cwd, secret, label }) => {
    const result = spawnSync(command, args, {
        cwd,
        input: secret,
        encoding: "utf8",
        env: process.env,
        stdio: ["pipe", "inherit", "inherit"],
        windowsHide: true,
    })
    if (result.error) fail(`${label} could not start: ${result.error.message}`)
    if (result.status !== 0) fail(`${label} exited ${result.status}`)
    console.log(`ok: ${label}`)
}

const main = async () => {
    const args = process.argv.slice(2)
    const name = valueFor(args, "--name")
    const envName = valueFor(args, "--from-env") ?? name
    const repositories = valuesFor(args, "--repo")
    const stacks = valuesFor(args, "--stack").map(parseStack)
    const planOnly = args.includes("--plan")

    if (!name || !/^[A-Z][A-Z0-9_]*$/.test(name)) {
        fail("--name must be an uppercase secret name such as CODECOV_TOKEN")
    }
    if (!envName || !/^[A-Z][A-Z0-9_]*$/.test(envName)) {
        fail("--from-env must name an uppercase process environment variable")
    }
    if (repositories.length === 0 && stacks.length === 0) {
        fail("at least one --repo or --stack target is required")
    }
    for (const repository of repositories) {
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
            fail(`invalid GitHub repository: ${repository}`)
        }
    }

    console.log(`secret name: ${name}`)
    console.log(`source: process env ${envName}, otherwise hidden interactive input`)
    for (const { project, record } of stacks) console.log(`stack: ${project} -> .stacks/${record}.enc`)
    for (const repository of repositories) console.log(`github: ${repository} -> Actions secret ${name}`)
    console.log("value output: never")
    if (planOnly) return

    let secret = process.env[envName]
    const inherited = Boolean(secret)
    if (!secret) secret = await readHidden(`value for ${name} (hidden): `)
    if (!secret || secret.trim() === "") fail("empty secret; nothing was written")

    process.env[envName] = secret
    try {
        const npm = process.platform === "win32" ? "npm.cmd" : "npm"
        for (const { project, record } of stacks) {
            runWithSecret({
                command: npm,
                args: ["run", "secret:set", "--", record],
                cwd: project,
                secret,
                label: `.stacks/${record}.enc in ${project}`,
            })
        }

        const gh = process.platform === "win32" ? "gh.exe" : "gh"
        for (const repository of repositories) {
            runWithSecret({
                command: gh,
                args: ["secret", "set", name, "--repo", repository],
                cwd: process.cwd(),
                secret,
                label: `${name} in ${repository}`,
            })
        }
    } finally {
        process.env[envName] = ""
        delete process.env[envName]
        secret = ""
    }

    console.log(`source env cleared: ${envName}${inherited ? " (inherited value was process-local)" : ""}`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
