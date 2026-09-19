/* Lane v5-5 helper: report likely reader-visible copy per file in a directory. */
const fs = require("fs")
const path = require("path")

const target = process.argv[2]
const walk = (dir, out) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (/\.tsx?$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name)) out.push(full)
    }
    return out
}
for (const file of walk(target, [])) {
    const raw = fs.readFileSync(file, "utf8")
    const body = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ")
    const copy = []
    for (const m of body.matchAll(/"([^"\n]{4,})"/g)) {
        const s = m[1]
        if (/^[a-z0-9_./#-]+$/.test(s)) continue
        copy.push(s)
    }
    for (const m of body.matchAll(/>([^<>{}\n]{6,})</g)) {
        const s = m[1].trim()
        if (s && !/^[a-z]/.test(s)) copy.push("JSX:" + s)
    }
    console.log(`=== ${file.replace(/\\/g, "/")} ${copy.length ? "\n" + copy.join("\n") : " (no copy)"}`)
}
