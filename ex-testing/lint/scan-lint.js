// Reads an eslint --format json report and prints non-style findings per file.
// Usage: node scan-lint.js <report.json> [includeJsdoc]
const r = require(process.argv[2]);
const SKIP = new Set([
    "indent",
    "semi",
    "quotes",
    "object-curly-newline",
    "function-call-argument-newline",
    "array-element-newline",
    "@typescript-eslint/array-type",
]);
if (!process.argv[3]) SKIP.add("starci-be/require-export-jsdoc");
for (const f of r) {
    const errs = f.messages.filter((m) => !SKIP.has(m.ruleId));
    if (!errs.length) continue;
    console.log("FILE", f.filePath.replace(/\\/g, "/").split("/src/")[1]);
    for (const m of errs) {
        console.log("  ", `${m.line}:${m.column}`, m.ruleId, String(m.message).slice(0, 110));
    }
}
