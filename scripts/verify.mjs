#!/usr/bin/env node
/**
 * verify.mjs — check that the canon still describes the source it claims to describe.
 *
 * WHAT IT READS
 * `canon/<role>/**\/*.md` — the prose, recursively, wherever it sits in the canon's folders. It
 * used to read `patterns/<role>/*.md`; the prose moved to `canon/` and `patterns/` became
 * executable-only, so this follows it. Nothing else about the check changed.
 *
 * WHY THIS EXISTS
 * A canon file earns its authority by being grounded: it names a real file and quotes a real
 * count. That is also what makes it rot. The source moves, the document does not, and nothing
 * says so — a reader then trusts a path that was deleted a fortnight ago.
 *
 * This was not hypothetical. On the day these were carried forward, one file anchored a rule to
 * `src/components/reuseable/TagChips`, which no longer exists, and another claimed "371 files
 * extend WithClassNames" when the real number was 669. Both docs read as authoritative.
 *
 * WHAT IT CHECKS
 *   anchors  every `src/...` path a document names must exist in that source tree
 *   counts   a claim of the form "N file" on a line that also names a symbol gets recounted
 *
 * A missing anchor is a FAIL: the rule points at nothing. A drifted count is a WARN: the rule
 * is probably still true, but its evidence is stale and a reader will quote the old number.
 *
 *   node .claude/patterns/verify.mjs [fe|be]
 *
 * EXIT CODES
 *   0  every anchor resolves
 *   1  an anchor is missing, or the workspace has no source registered for that role
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLAUDE = join(HERE, "..");
const WORKSPACE = join(CLAUDE, "scripts", "workspace", "read-workspace-context.mjs");

/**
 * Ask the workspace context where a source lives.
 * Never hardcode it — that is the very habit the workspace skills exist to end.
 * @param {"fe"|"be"} role
 * @returns {string|null}
 */
function sourceOf(role) {
    try {
        return execFileSync(process.execPath, [WORKSPACE, `${role}.path`], {
            encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch { return null; }
}

/**
 * Every backticked token in a document that looks like a path into the source.
 * Trailing punctuation and a line/column suffix (`foo.tsx:240`) are stripped, because an
 * anchor is often written the way an editor prints it.
 * @param {string} text
 * @returns {Array<{path: string, line: number}>}
 */
function anchors(text) {
    const out = [];
    text.split(/\r?\n/).forEach((line, i) => {
        // Not only backticked ones. The strongest anchors sit inside code blocks, written as
        // a comment above the example — `// ✅ src/components/...`. Scanning the whole line
        // roughly tripled the coverage of this check.
        // The lookbehind matters more than it looks. Without it, `apps/core/src/app.module.ts`
        // matched from the inner `src/`, and the checker then hunted for `src/app.module.ts` at
        // the repo root and reported a perfectly correct document as broken.
        for (const m of line.matchAll(/(?<![\w/.@-])(?:src|apps|libs)\/[\w.@/-]+/g)) {
            const p = m[0].replace(/[:#].*$/, "").replace(/[.,;)]+$/, "");

            // A shape, not a file. Globs and elisions describe where a family of files lives;
            // an author writing `src/components/.../ContactForm` is abbreviating, not pointing.
            if (/[*<>{}]/.test(p)) continue;
            if (/\.{3}|…|\/\/+/.test(p)) continue;

            out.push({ path: p, line: i + 1 });
        }
    });
    return out;
}

/**
 * Does this path exist, allowing the usual unwritten extensions?
 * Documents name `src/modules/types/base/class-name`, not the `.ts` on the end.
 * @param {string} root source tree
 * @param {string} rel
 * @returns {boolean}
 */
function resolves(root, rel) {
    const base = join(root, rel);
    if (existsSync(base)) return true;
    for (const ext of [".ts", ".tsx", ".mts", ".js", ".jsx", ".css", ".json"]) {
        if (existsSync(base + ext)) return true;
    }
    // A folder is often named by its index file.
    for (const idx of ["index.ts", "index.tsx"]) {
        if (existsSync(join(base, idx))) return true;
    }
    return false;
}

/**
 * Every `.md` under a canon role folder, recursively, as paths relative to that folder.
 * The canon groups its prose into subfolders (`authoring/`, `contracts/`, `modules/`), so a flat
 * listing would silently check nothing.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]}
 */
function mdFiles(dir, prefix = "") {
    const out = [];
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) out.push(...mdFiles(join(dir, e.name), rel));
        else if (e.name.endsWith(".md")) out.push(rel);
    }
    return out.sort();
}

/**
 * Claims of the form "N file" or "N files" where the same line also names a symbol.
 * Only these can be rechecked mechanically; a count with no symbol beside it is left alone
 * rather than guessed at.
 * @param {string} text
 * @returns {Array<{n: number, symbol: string, line: number}>}
 */
function counts(text) {
    const out = [];
    text.split(/\r?\n/).forEach((line, i) => {
        const m = /(\d{2,})\s*(?:file|files)\b/.exec(line);
        if (!m) return;
        const sym = [...line.matchAll(/`([A-Za-z][\w.]*)`/g)]
            .map((x) => x[1])
            .find((s) => /^[A-Z]/.test(s) || s.includes("."));
        if (!sym) return;
        out.push({ n: Number(m[1]), symbol: sym, line: i + 1 });
    });
    return out;
}

/**
 * How many files under `root/src` mention this symbol.
 * ripgrep if available, otherwise a plain walk — this must run on a machine with no extras.
 * @param {string} root
 * @param {string} symbol
 * @returns {number}
 */
function countFiles(root, symbol) {
    const src = join(root, "src");
    if (!existsSync(src)) return -1;
    let n = 0;
    const walk = (dir) => {
        let entries;
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (e.name === "node_modules" || e.name.startsWith(".")) continue;
            const full = join(dir, e.name);
            if (e.isDirectory()) { walk(full); continue; }
            if (!/\.(ts|tsx|mts|js|jsx)$/.test(e.name)) continue;
            try { if (readFileSync(full, "utf8").includes(symbol)) n++; } catch { /* unreadable */ }
        }
    };
    walk(src);
    return n;
}

// -------------------------------------------------------------------------

const only = process.argv[2];
const roles = only ? [only] : ["fe", "be"];

let fails = 0;
let warns = 0;
let checked = 0;

for (const role of roles) {
    const dir = join(CLAUDE, "canon", role);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;

    const root = sourceOf(role);
    if (!root) {
        console.log(`SKIP  ${role}/ — no ${role} source registered.`);
        console.log(`      node .claude/scripts/register-workspace-source.mjs --${role} <dir>`);
        fails++;
        continue;
    }

    console.log(`\n# canon/${role}/  against  ${root}`);

    for (const file of mdFiles(dir)) {
        const text = readFileSync(join(dir, file), "utf8");

        const missing = [];
        const seen = new Set();
        for (const a of anchors(text)) {
            if (seen.has(a.path)) continue;
            seen.add(a.path);
            checked++;
            if (!resolves(root, a.path)) missing.push(a);
        }

        const drifted = [];
        for (const c of counts(text)) {
            const real = countFiles(root, c.symbol);
            if (real >= 0 && real !== c.n) drifted.push({ ...c, real });
        }

        if (!missing.length && !drifted.length) {
            console.log(`ok    ${file}  (${seen.size} anchors)`);
            continue;
        }
        console.log(`      ${file}`);
        for (const m of missing) {
            console.log(`FAIL    :${m.line}  ${m.path} — named here, does not exist in the source`);
            fails++;
        }
        for (const d of drifted) {
            console.log(`WARN    :${d.line}  claims ${d.n} files mention ${d.symbol}; counted ${d.real}`);
            warns++;
        }
    }
}

console.log(`\n${checked} anchor(s) checked · ${fails} failed · ${warns} stale count(s)`);
if (fails) {
    console.log("\nA rule anchored to a file that no longer exists is a claim with nothing behind it.");
    console.log("Re-ground it against the real source, or delete it.");
    process.exit(1);
}
