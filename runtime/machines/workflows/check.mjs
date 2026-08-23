#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

export function parseSkillRoutes(text) {
    return [...text.matchAll(/`(skills\/[^`/]+\/SKILL\.md)`/g)].map((match) => match[1])
}

function workflowContextPaths() {
    const root = join(trustRoot, "workflows")
    return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(root, entry.name, "context.md"))
        .filter(existsSync)
}

export function checkWorkflows(options = {}) {
    const failures = []
    const skillRoot = options.skillRoot ?? join(trustRoot, "skills")
    const physical = (options.physicalSkills ?? readdirSync(skillRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join(skillRoot, entry.name, "SKILL.md")))
        .map((entry) => `skills/${entry.name}/SKILL.md`)).sort()
    const contexts = options.contexts ?? workflowContextPaths().map((path) => ({
        path: relative(trustRoot, path).split(sep).join("/"),
        text: readFileSync(path, "utf8"),
    }))
    const routed = contexts.flatMap((context) => parseSkillRoutes(context.text).map((skill) => ({
        skill,
        workflow: context.path,
    })))
    for (const skill of physical) {
        const owners = routed.filter((route) => route.skill === skill)
        if (owners.length === 0) failures.push(`${skill}: no workflow owner`)
        if (owners.length > 1) failures.push(`${skill}: multiple workflow owners (${owners.map((owner) => owner.workflow).join(", ")})`)
    }
    for (const route of routed) {
        if (!physical.includes(route.skill)) failures.push(`${route.workflow}: missing skill target ${route.skill}`)
    }
    return { ok: failures.length === 0, physical, routed, failures }
}

function main() {
    const result = checkWorkflows()
    if (!result.ok) {
        console.error("workflow parity failed")
        for (const failure of result.failures) console.error(`- ${failure}`)
        return 1
    }
    console.log(`${result.physical.length} skill(s) have exactly one lifecycle workflow owner`)
    return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main()
}
