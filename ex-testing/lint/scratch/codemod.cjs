/*
 * Lane v5-5 codemod: replace hardcoded reader copy with `copy`/`t` lookups.
 *
 * Two op kinds, so that neither indentation nor quoting can silently skip a string:
 *   ["sub",  needle, replacement, count, key]  - exact substring, must occur `count` times
 *   ["line", trimmedLine, replacement, count, key] - whole JSX line whose trim() equals the needle
 *                                                   (re-applied with the line's own indentation)
 * A file is only written when every one of its ops matched, so a miss is a no-op, never a partial edit.
 * The keys are echoed for the report's string -> key inventory.
 */
const fs = require("fs")
const path = require("path")

const ROOT = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-frontend"
const PLAN = require(path.join(__dirname, `plan-${process.argv[2]}.cjs`))

let failed = 0
for (const entry of PLAN) {
    const file = path.join(ROOT, entry.file)
    let text = fs.readFileSync(file, "utf8")
    const misses = []
    const applied = []
    for (const op of entry.ops) {
        const [kind, needle, replacement, expected, key] = op
        if (kind === "sub") {
            const count = text.split(needle).length - 1
            if (count !== expected) {
                misses.push(`MISS sub ${entry.file}: found ${count} of ${expected} :: ${JSON.stringify(needle).slice(0, 80)} :: ${key}`)
                continue
            }
            text = text.split(needle).join(replacement)
            applied.push(`ok  sub  ${key}\t${JSON.stringify(needle).slice(0, 60)} -> ${JSON.stringify(replacement).slice(0, 60)}`)
            continue
        }
        if (kind === "line") {
            const lines = text.split(/\r?\n/)
            let hits = 0
            const out = lines.map(line => {
                if (line.trim() !== needle) return line
                hits++
                const indent = line.match(/^\s*/)[0]
                return indent + replacement
            })
            if (hits !== expected) {
                misses.push(`MISS line ${entry.file}: found ${hits} of ${expected} :: ${JSON.stringify(needle)} :: ${key}`)
                continue
            }
            text = out.join("\n")
            applied.push(`ok  line ${key}\t${JSON.stringify(needle).slice(0, 60)} -> ${JSON.stringify(replacement).slice(0, 60)}`)
            continue
        }
        if (kind === "delline") {
            const lines = text.split(/\r?\n/)
            const out = lines.filter(line => line.trim() !== needle)
            const removed = lines.length - out.length
            if (removed !== expected) {
                misses.push(`MISS delline ${entry.file}: found ${removed} of ${expected} :: ${JSON.stringify(needle)} :: ${key}`)
                continue
            }
            text = out.join("\n")
            applied.push(`ok  del  ${key}\tremoved ${expected} line(s) ${JSON.stringify(needle).slice(0, 50)}`)
            continue
        }
        misses.push(`BAD OP kind ${kind} in ${entry.file}`)
    }
    applied.forEach(line => console.log(line))
    if (misses.length > 0) {
        misses.forEach(miss => console.error(miss))
        console.error(`SKIP WRITE ${entry.file}: ${misses.length} op(s) unmatched`)
        failed += misses.length
        continue
    }
    fs.writeFileSync(file, text)
    console.log(`WROTE ${entry.file}`)
}
if (failed > 0) process.exitCode = 1
