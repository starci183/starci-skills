/* Lane v5-5 helper: print the exact JSON of every line whose trimmed content matches a pattern. */
const fs = require("fs")

const ROOT = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-frontend/"
const file = process.argv[2]
const text = fs.readFileSync(ROOT + file, "utf8")
text.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const hit = process.argv.slice(3).some(needle => trimmed === needle || trimmed.startsWith(needle) || trimmed.includes(needle))
    if (hit) console.log(`${i + 1}:\t${JSON.stringify(line)}`)
})
