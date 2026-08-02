#!/usr/bin/env node
/**
 * search-component-matrix.mjs — which component a data shape becomes, ranked.
 *
 * Enter the SHAPE OF THE DATA you are holding ("a list that expands each row", "one pressable card",
 * "a wrapping row of tags") and read back the top few components, best match first, via BM25 over the
 * matrix (canon/fe/explore/component/data/matrix.csv). Never reads the whole file into your context —
 * one query returns three rows.
 *
 *   node scripts/search/search-component-matrix.mjs "<what you have>" [-n N]
 *
 * EXIT 0 with the ranked rows · EXIT 1 when nothing scores (describe the data shape more concretely).
 */
import { search } from "./core.mjs";

const argv = process.argv.slice(2);
const nAt = argv.indexOf("-n");
const n = nAt >= 0 ? Math.max(1, Number(argv[nAt + 1]) || 3) : 3;
const query = argv.filter((a, i) => i !== nAt && i !== nAt + 1).join(" ").trim();

if (!query) {
    console.error('usage: search-component-matrix.mjs "<what you have>" [-n N]');
    console.error('  e.g. "a list where each row expands to show more"');
    process.exit(1);
}

const { rows, checked } = search("component", query, n);
if (!rows.length) {
    console.log(`no component scored against "${query}" in ${checked} rows.`);
    console.log("Describe the DATA shape more concretely: how many, what kind, pressable or not.");
    process.exit(1);
}
console.log(`component matrix — top ${rows.length} of ${checked} for "${query}":`);
for (const r of rows) {
    console.log("");
    for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${v}`);
}
process.exit(0);
