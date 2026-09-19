/* Lane v5-5 helper: for each "file<TAB>needle" line, report occurrence counts. */
const fs = require("fs")

const ROOT = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-frontend/"
const spec = fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(l => l.trim())
for (const row of spec) {
    const [file, ...rest] = row.split("|||")
    const needle = rest.join("|||").replace(/\\n/g, "\n")
    const text = fs.readFileSync(ROOT + file, "utf8")
    const n = text.split(needle).length - 1
    const lines = []
    text.split(/\r?\n/).forEach((line, i) => {
        if (line.includes(needle)) lines.push(i + 1)
    })
    console.log(`${n}\t${file}\t${JSON.stringify(needle).slice(0, 70)}\tlines:${lines.join(",")}`)
}
