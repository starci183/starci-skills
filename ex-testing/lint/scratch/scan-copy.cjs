/* Inventory helper for lane v5-5: crude prose scan over in-scope source files. */
const fs = require("fs")
const path = require("path")

const ROOT = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-frontend/src"
const SCOPE = ["components", "features"]
const VISIBLE = new Set(["aria-label", "placeholder", "title", "alt", "aria-description", "label", "errorMessage", "compactNavigationLabel", "aria-labelledby", "mainLandmark", "footer", "header"])

const walk = (dir, out) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (/\.tsx?$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(full)
    }
    return out
}

const prose = (text) => typeof text === "string" && /\s/.test(text) && /^[A-Z]/.test(text)

const files = SCOPE.flatMap((part) => walk(path.join(ROOT, part), []))
const report = []
for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
    lines.forEach((line, i) => {
        const hits = []
        for (const m of line.matchAll(/(?:aria-label|placeholder|title|alt|label|compactNavigationLabel|aria-labelledby|errorMessage)="([^"]+)"/g)) {
            if (prose(m[1]) || /[a-z]/.test(m[1])) hits.push(`attr:${m[1]}`)
        }
        for (const m of line.matchAll(/=\{"([^"]+)"\}/g)) hits.push(`attrExpr:${m[1]}`)
        for (const m of line.matchAll(/>([^<>{}\n]+)</g)) if (prose(m[1].trim())) hits.push(`jsx:${m[1].trim()}`)
        const jsxText = line.trim()
        if (/^[A-Z][a-z]+.*[.?!]$/.test(jsxText) && !line.includes("import") && !line.trim().startsWith("*") && !line.trim().startsWith("//")) hits.push(`jsxTextLine:${jsxText}`)
        for (const m of line.matchAll(/"([A-Z][^"]*\s[^"]*)"/g)) hits.push(`string:${m[1]}`)
        for (const m of line.matchAll(/`([A-Z][^`$\s][^`]*)`/g)) if (!m[1].includes("${")) hits.push(`template:${m[1]}`)
        const filtered = hits.filter((h) => !/^\s*$/.test(h))
        if (filtered.length) report.push(`${path.relative(ROOT, file).replace(/\\/g, "/")}:${i + 1}: ${filtered.join(" | ")}`)
    })
}
fs.writeFileSync("D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/scratch/copy-inventory.txt", report.join("\n"))
console.log(report.length + " candidate lines")
void VISIBLE
