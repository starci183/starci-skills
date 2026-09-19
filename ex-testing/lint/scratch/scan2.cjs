/* Lane v5-5 helper: list lines that look like reader-visible copy in given dirs. */
const fs = require("fs")
const path = require("path")

const ROOT = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-frontend/src"
const DIRS = process.argv.slice(2)

const walk = (dir, out) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (/\.tsx?$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name)) out.push(full)
    }
    return out
}

const files = DIRS.flatMap(d => walk(path.join(ROOT, d), []))
for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
    const hits = []
    lines.forEach((line, i) => {
        const n = i + 1
        for (const m of line.matchAll(/(?:aria-label|placeholder|title|alt|label|hint|message|description|compactNavigationLabel|primaryLabel|ariaLabel)="([^"]*)"/g)) {
            if (/[a-z]/.test(m[1]) && /\s/.test(m[1])) hits.push(`${n}: ATTR ${m[1]}`)
        }
        for (const m of line.matchAll(/(?:=\{|: )"(?:[A-Z][^"]*\s[^"]*|[^"]*[^\x00-\x7F][^"]*)"/g)) {
            const s = m[0].slice(2, -1)
            if (s.includes("/") || s.includes("-") && s.length < 12) continue
            if (/[a-z]{3}/.test(s) && (/\s/.test(s) || /[^\x00-\x7F]/.test(s))) hits.push(`${n}: STR ${s}`)
        }
        const t = line.trim()
        if (/^[A-Za-z][^<>*`"'{}]*[.?!]$/.test(t) && !/^(import|export|const|let|return|void|if|else|throw)/.test(t) && t.split(" ").length > 3) hits.push(`${n}: TEXT ${t}`)
        for (const m of line.matchAll(/`([^`$]*\s[^`]*)`/g)) if (/[A-Z]/.test(m[1])) hits.push(`${n}: TPL ${m[1]}`)
    })
    if (hits.length) console.log("=== " + path.relative(ROOT, file).replace(/\\/g, "/") + "\n" + hits.join("\n"))
}
