#!/usr/bin/env node
/**
 * GATE — a business value the server owns is read from the API, not hardcoded in the front end.
 *
 * A price, an XP amount, a threshold, a fee, a discount, a passing score — these are the back end's to
 * decide (see canon/fe/business-parity.md). Written as a literal in a component, the copy is a lie the
 * day the server changes the real one, and the reviewer cannot see it drift. This gate flags a numeric
 * literal assigned to a business-named identifier in front-end source, so the value gets sourced from
 * the API instead.
 *
 * It is a heuristic — it catches the obvious ones and stays quiet on layout numbers (px, ms, z-index,
 * counts, indices). A flagged line is a question ("should this come from the API?"), not a verdict.
 *
 *   node scripts/gates/check-fe-business-constants.mjs [src-root]   (default: ./src)
 *
 * EXIT 0 none found · EXIT 1 one or more business literals, each at file:line.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");

// Identifiers that name a business value the back end owns. Deliberately narrow — broadening this is
// how the gate turns into noise everyone disables.
const BUSINESS = /\b(price|cost|fee|amount|discount|xp|reward|coin|credits?|points?|passing[_-]?score|threshold|quota|max[_-]?attempts|min[_-]?score|tax[_-]?rate|commission|penalty)\b/i;
// Layout / non-business numbers that share the shape — never flag these.
const IGNORE = /\b(px|rem|em|ms|width|height|top|left|right|bottom|zindex|z[_-]?index|opacity|index|length|count|size|gap|margin|padding|duration|delay|offset|line|column|page|limit|perpage|per[_-]?page)\b/i;

const hits = [];
function walk(dir) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir)) {
        if (e === "node_modules" || e === ".next" || e === "dist") continue;
        const p = join(dir, e);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(p)) && !p.endsWith(".d.ts")) scan(p);
    }
}
function scan(file) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
        // a business-named identifier assigned or defaulted to a bare number: `price = 299000`, `xp: 2`, `reward ?? 10`
        const m = line.match(/([A-Za-z_$][\w$]*)\s*(?::|=|\?\?)\s*(\d[\d_.]*)/);
        if (!m) return;
        const name = m[1];
        if (!BUSINESS.test(name) || IGNORE.test(name)) return;
        if (/from ['"]|import |\.length|\.size/.test(line)) return;
        hits.push(`${file}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
}

if (!existsSync(SRC)) {
    console.log(`check-fe-business-constants: no src at ${SRC} — pass the front-end src root as the first argument`);
    process.exit(0);
}
walk(SRC);

if (hits.length) {
    console.log(`check-fe-business-constants: FAIL — ${hits.length} business value(s) hardcoded in front-end source`);
    for (const h of hits) console.log(`  ${h}`);
    console.log("\nA value the server owns is read from the API, not written into a component (canon/fe/business-parity.md).");
    process.exit(1);
}
console.log("check-fe-business-constants: no business value hardcoded in front-end source");
process.exit(0);
