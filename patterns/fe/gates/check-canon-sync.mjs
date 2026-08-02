#!/usr/bin/env node
/**
 * check-canon-sync.mjs — the registry and the canon must quote the same pixels.
 *
 * WHY THIS EXISTS
 * There are two places a number can live. `patterns/fe/patterns.mjs` is the executable one: the
 * test runner measures a rendered node against it, so whatever it says is what the app is held
 * to. `canon/fe/principles/spacing.md` is the one a person reads before writing a component, and it is
 * the only one anybody quotes in review.
 *
 * Nothing keeps them equal. Someone widens a block seam from 24 to 32 in the registry because a
 * test was failing, the essay still says 24, and for the next month every reviewer enforces a
 * number the machine has stopped believing. The divergence is invisible precisely because both
 * files read as authoritative.
 *
 * So: every pattern in the registry that names a PIXEL must have that same pixel written down in
 * the canon, in the paragraph that names the token. Tokens that carry no pixel (`sticky-top`,
 * `push-end`, `stack-below` — position, margin-auto, breakpoint) are not checked here; there is
 * no number to disagree about.
 *
 * HOW A TOKEN IS FOUND IN THE CANON
 * By its backticked (or quoted) name — `block-boundary`, not the bare word. Prose says "identity"
 * and "reel" for ordinary reasons; the backtick is what makes a mention a CITATION. If the canon
 * quotes a pixel with a `px` suffix anywhere in that paragraph, only px-suffixed numbers count,
 * so a step number ("step 6") can never stand in for a value.
 *
 * The reverse direction is checked too, narrowly: any token used inside a `data-principles="…"`
 * in a FENCED example must exist in the registry. An example nobody can render is worse than no
 * example, because it will be copied. Only fenced blocks count — the canon also writes
 * `data-principles="p-4"` inline, mid-sentence, precisely to say that writing it would be wrong,
 * and a gate that cannot tell a demonstration from a warning about one is a gate people disable.
 *
 *   node patterns/fe/gates/check-canon-sync.mjs            # against this .claude/
 *   node patterns/fe/gates/check-canon-sync.mjs <root>     # against another root (the tests)
 *
 * EXIT CODES
 *   0  every pixel in the registry is quoted in the canon, and every cited token exists
 *   1  a divergence, a token nobody wrote down, or either file missing
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
/** `.claude/` — this file sits at `patterns/fe/gates/`. */
const DEFAULT_ROOT = resolve(HERE, "..", "..", "..");

const argRoot = process.argv.slice(2).find((a) => !a.startsWith("--"));
const ROOT = argRoot ? resolve(argRoot) : DEFAULT_ROOT;

const REGISTRY = join(ROOT, "patterns", "fe", "patterns.mjs");
const CANON = join(ROOT, "canon", "fe", "principles", "spacing.md");

/** Paths are printed with forward slashes so a message reads the same on every platform. */
const show = (p) => p.replace(/\\/g, "/");
/** Relative to the root, for the short form in a summary line. */
const rel = (p) => show(p).slice(show(ROOT).length + 1);

// -------------------------------------------------------------------------
// Both files have to be there before anything can be compared. Resolving the
// path and saying which one is missing is the whole job here — a stack trace
// from an import of a file that does not exist tells the caller nothing.
// -------------------------------------------------------------------------

if (!existsSync(REGISTRY)) {
    console.log("check-canon-sync: FAIL — the registry is missing.");
    console.log(`  registry  ${show(REGISTRY)}  does not exist`);
    console.log("\nThe registry is the executable half. Without it there is nothing to hold the canon to.");
    process.exit(1);
}

if (!existsSync(CANON)) {
    console.log("check-canon-sync: FAIL — the canon is missing.");
    console.log(`  registry  ${show(REGISTRY)}`);
    console.log(`  canon     ${show(CANON)}  does not exist`);
    console.log("\nPixels live in patterns/; the prose that explains them lives in canon/.");
    console.log("Write canon/fe/principles/spacing.md, or point this gate at a root that has one.");
    process.exit(1);
}

let PATTERNS;
try {
    ({ PATTERNS } = await import(pathToFileURL(REGISTRY).href));
} catch (e) {
    console.log("check-canon-sync: FAIL — the registry could not be loaded.");
    console.log(`  registry  ${show(REGISTRY)}`);
    console.log(`  ${e.message}`);
    process.exit(1);
}

if (!PATTERNS || typeof PATTERNS !== "object") {
    console.log("check-canon-sync: FAIL — the registry exports no PATTERNS object.");
    console.log(`  registry  ${show(REGISTRY)}`);
    process.exit(1);
}

const text = readFileSync(CANON, "utf8");

// -------------------------------------------------------------------------

/**
 * The pixel value(s) a pattern commits to, or an empty list when it commits to none.
 * `padding-xy` commits to two: across and down.
 * @param {object} entry
 * @returns {number[]}
 */
function pixelsOf(entry) {
    if (!entry || typeof entry !== "object") return [];
    if (entry.prop === "padding-xy") {
        return [entry.x, entry.y].filter((n) => typeof n === "number");
    }
    return typeof entry.px === "number" ? [entry.px] : [];
}

/**
 * The canon split into paragraphs, each remembering the line it started on, so a divergence can
 * be reported at a place a person can open. A paragraph is the unit because prose names a token
 * in one sentence and its pixel in the next.
 * @param {string} src
 * @returns {Array<{line: number, text: string}>}
 */
function paragraphs(src) {
    const out = [];
    let cur = null;
    src.split(/\r?\n/).forEach((l, i) => {
        if (!l.trim()) { cur = null; return; }
        if (cur) { cur.text += `\n${l}`; return; }
        cur = { line: i + 1, text: l };
        out.push(cur);
    });
    return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** A CITATION of a token: backticked, or inside quotes. A bare English word is not one. */
const citation = (token) => new RegExp("[`\"']" + escape(token) + "[`\"']");

/**
 * The numbers a paragraph offers as values. When any number carries a `px` suffix, only those
 * count — otherwise "step 6" would silently satisfy a pattern whose value is 6px.
 * @param {string} para
 * @returns {number[]}
 */
function valuesIn(para) {
    const px = [...para.matchAll(/(\d+)\s*px\b/g)].map((m) => Number(m[1]));
    if (px.length) return px;
    return [...para.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

const PARAS = paragraphs(text);
const failures = [];
let carried = 0;

for (const [token, entry] of Object.entries(PATTERNS)) {
    const want = pixelsOf(entry);
    if (!want.length) continue; // no number, nothing to disagree about
    carried++;

    const re = citation(token);
    const hits = PARAS.filter((p) => re.test(p.text));

    if (!hits.length) {
        failures.push(`${token} — named nowhere in canon; a pixel nobody wrote down is not a shared rule`);
        continue;
    }

    // Prefer the LINES that cite the token over the whole paragraph. The canon writes a step as a
    // markdown table, and a table is one paragraph: without this, a row whose number drifted would
    // be satisfied by its neighbour's number sitting two rows down.
    const lines = hits.flatMap((p) => p.text.split("\n")).filter((l) => re.test(l));
    const tight = new Set(valuesIn(lines.join("\n")));
    const found = tight.size ? tight : new Set(hits.flatMap((p) => valuesIn(p.text)));
    const missing = want.filter((n) => !found.has(n));
    if (!missing.length) continue;

    const where = `${rel(CANON)}:${hits[0].line}`;
    const quoted = found.size ? `quotes ${[...found].join(", ")}` : "quotes no pixel at all";
    failures.push(
        `${token} — registry says ${want.join("px, ")}px; ${where} ${quoted}`,
    );
}

/**
 * The fenced code blocks, each with the line its content starts on. These are the only places a
 * reader copies from, which is what makes them the only places a bad token can do damage.
 * @param {string} src
 * @returns {Array<{line: number, text: string}>}
 */
function fences(src) {
    const lines = src.split(/\r?\n/);
    const out = [];
    let open = null;
    lines.forEach((l, i) => {
        if (!/^\s*```/.test(l)) { if (open) open.text += `${l}\n`; return; }
        if (open) { open = null; return; }
        open = { line: i + 2, text: "" };
        out.push(open);
    });
    return out;
}

// The other direction, kept narrow on purpose: an example that cites a token which does not
// exist cannot be rendered, and it WILL be copied out of the canon into a component.
const cited = new Map();
for (const block of fences(text)) {
    for (const m of block.text.matchAll(/data-principles\s*=\s*["'`]([^"'`]+)["'`]/g)) {
        const line = block.line + block.text.slice(0, m.index).split("\n").length - 1;
        for (const tok of m[1].trim().split(/\s+/)) {
            if (!cited.has(tok)) cited.set(tok, line);
        }
    }
}
for (const [tok, line] of cited) {
    if (tok in PATTERNS) continue;
    failures.push(`${tok} — cited in a data-principles example at ${rel(CANON)}:${line}; the registry has no such pattern`);
}

// -------------------------------------------------------------------------

if (!failures.length) {
    console.log(`check-canon-sync: OK — ${carried} pattern(s) carry a pixel, and canon quotes every one.`);
    process.exit(0);
}

console.log(`check-canon-sync: ${failures.length} divergence(s) between ${rel(REGISTRY)} and ${rel(CANON)}\n`);
for (const f of failures) console.log(`FAIL  ${f}`);
console.log("\nOne of the two is wrong. Decide which, change that one, and leave the other alone —");
console.log("editing both to agree without deciding is how the number drifted in the first place.");
process.exit(1);
