/*
 * Lane v5-5 gate 5: en/vi key parity + a leftover-copy sweep over the in-scope source.
 * Exit 0 only when the two catalogues hold exactly the same key paths and no in-scope source line
 * still carries reader-visible English prose.
 */
const fs = require("fs")
const path = require("path")

const SRC = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-frontend/src"

/** Every leaf key path in a catalogue, with its value. */
const flatten = (node, prefix, out) => {
    for (const [key, value] of Object.entries(node)) {
        const p = prefix ? `${prefix}.${key}` : key
        if (value !== null && typeof value === "object") flatten(value, p, out)
        else out.set(p, value)
    }
    return out
}

const en = flatten(JSON.parse(fs.readFileSync(path.join(SRC, "messages/en.json"), "utf8")), "", new Map())
const vi = flatten(JSON.parse(fs.readFileSync(path.join(SRC, "messages/vi.json"), "utf8")), "", new Map())

const onlyEn = [...en.keys()].filter(k => !vi.has(k))
const onlyVi = [...vi.keys()].filter(k => !en.has(k))
console.log(`en keys: ${en.size}`)
console.log(`vi keys: ${vi.size}`)
console.log(`missing in vi: ${onlyEn.length ? onlyEn.join(", ") : "(none)"}`)
console.log(`missing in en: ${onlyVi.length ? onlyVi.join(", ") : "(none)"}`)
const untranslated = [...en.keys()].filter(k => vi.get(k) === en.get(k) && /[A-Za-z]{3}/.test(en.get(k)))
console.log(`identical en/vi values (suspect untranslated): ${untranslated.length ? untranslated.join(", ") : "(none)"}`)

/* Keys no source file asks for any more would be dead weight; report them as a note only. */
const walk = (dir, out) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name === "messages") continue
            walk(full, out)
        } else if (/\.tsx?$/.test(entry.name)) out.push(full)
    }
    return out
}
const sources = walk(SRC, []).map(file => fs.readFileSync(file, "utf8")).join("\n")
const appSources = [
    ...walk(path.join(SRC, "app"), []),
    ...walk(path.join(SRC, "hooks"), []),
    ...walk(path.join(SRC, "modules"), []),
].map(file => fs.readFileSync(file, "utf8"))
const all = sources + "\n" + appSources.join("\n")
const unused = [...en.keys()].filter(key => {
    const leaf = key.split(".").pop()
    return !all.includes(`"${leaf}"`) && !all.includes(`${key}"`)
})
console.log(`keys no source file names by leaf (check by hand): ${unused.length ? unused.join(", ") : "(none)"}`)

/* The leftover sweep: any reader-visible English prose still sitting in in-scope source. */
const VISIBLE_ATTR = /(?:aria-label|placeholder|title|alt|label|hint|message|description|primaryLabel|compactNavigationLabel|ariaLabel)="([ A-Za-z0-9.,:;!?'\u2019&()\/%-]{4,})"/g
const JSX_TEXT = />([A-Z][A-Za-z]*(?: [A-Za-z0-9.,:;!?'\u2019&()\/%-]+){1,})</g
const SCOPE_DIRS = ["components", "features"]
const scopeFiles = SCOPE_DIRS.flatMap(part => walk(path.join(SRC, part), []))
const leftovers = []
for (const file of scopeFiles) {
    if (/\.(spec|test)\./.test(file)) continue
    const rel = path.relative(SRC, file).replace(/\\/g, "/")
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
        for (const m of line.matchAll(VISIBLE_ATTR)) leftovers.push(`${rel}:${i + 1}: attr ${m[0].trim()}`)
        for (const m of line.matchAll(JSX_TEXT)) leftovers.push(`${rel}:${i + 1}: text ${m[1].trim()}`)
        const trimmed = line.trim()
        if (/^[A-Z][a-z][a-z ,.'\u2019()-]{12,}[.?!]$/.test(trimmed)) leftovers.push(`${rel}:${i + 1}: jsxText ${trimmed}`)
    })
}
console.log(`\nleftover reader-visible English in in-scope source: ${leftovers.length}`)
leftovers.forEach(line => console.log("  " + line))
if (onlyEn.length > 0 || onlyVi.length > 0 || leftovers.length > 0) process.exitCode = 1
