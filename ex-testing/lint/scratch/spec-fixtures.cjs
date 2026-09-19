/* Lane v5-5 helper: show how each spec builds its render fixtures. */
const fs = require("fs")
const path = require("path")

const ROOT = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-frontend/src"
const files = process.argv.slice(2)
for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8")
    const lines = text.split(/\r?\n/)
    console.log(`\n########## ${rel} (${lines.length} lines)`)
    lines.forEach((line, i) => {
        const t = line.trim()
        if (/^(const|let)\s/.test(t) && /props|Props|render/i.test(t)) console.log(`${i + 1}: ${t}`)
        if (/render\(/.test(t)) console.log(`${i + 1}: ${t}`)
        if (/^(const\s+\w+Props|interface\s+\w+|\s*readonly)/.test(t)) console.log(`${i + 1}: ${t}`)
    })
}
