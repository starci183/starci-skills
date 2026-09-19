/* Lane v5-5 helper: show the render call sites and English literals asserted in specs. */
const fs = require("fs")
const path = require("path")

const ROOT = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-frontend/src"
const files = process.argv.slice(2)
for (const rel of files) {
    const file = path.join(ROOT, rel)
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
    console.log(`\n########## ${rel} (${lines.length} lines)`)
    lines.forEach((line, i) => {
        if (/render\(|<View|View\b.*=>|expect\(|getBy|queryBy|findAll|vi\.mock|^import/.test(line)) {
            console.log(`${i + 1}: ${line.trim()}`)
        }
    })
}
