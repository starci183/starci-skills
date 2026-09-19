/* Lane v5-5 helper: count how many times each needle occurs in a file, for codemod planning. */
const fs = require("fs")

const file = process.argv[2]
const text = fs.readFileSync(file, "utf8")
for (const needle of process.argv.slice(3)) {
    const n = text.split(needle).length - 1
    const where = []
    text.split(/\r?\n/).forEach((line, i) => {
        if (line.includes(needle)) where.push(i + 1)
    })
    console.log(`${n}\t${JSON.stringify(needle)}\tlines: ${where.join(",")}`)
}
