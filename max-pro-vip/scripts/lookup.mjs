#!/usr/bin/env node
// Look up library/registry.json. Return exactly the entry needed, don't dump the whole file into context.
//
//   node scripts/lookup.mjs Card              look up by name
//   node scripts/lookup.mjs --tier atom       list one tier
//   node scripts/lookup.mjs --missing         entries missing skeleton / state / verdict
//   node scripts/lookup.mjs --json Card       return raw JSON

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AXES = 15;

function load() {
    const raw = JSON.parse(readFileSync(join(ROOT, "library", "registry.json"), "utf8"));
    return (raw.entries ?? []).filter((e) => !e._comment);
}

function fmt(e) {
    const out = [`# ${e.name}  ·  ${e.tier}  ·  ${e.file}`, `  ${e.role}`];

    // A foundations entry is a scale, not a component. No API, no states, no skeleton.
    if (e.tier === "foundations") {
        if (e.root) out.push(`  Root: ${e.root}`);
        out.push("  Scale:");
        for (const s of e.scale ?? []) {
            const use = s.use ? `  - ${s.use}` : "";
            out.push(`    ${String(s.step).padEnd(20)} ${String(s.value ?? "").padEnd(18)} ${s.derived}${use}`);
        }
        if (e.relation) out.push(`  Relation: ${e.relation}`);
        if (e.forbidden?.length) out.push("  Forbidden:", ...e.forbidden.map((f) => `    - ${f}`));
        if (e.readBy?.length) out.push(`  Read by: ${e.readBy.join(" · ")}`);
        return out.join("\n");
    }

    if (e.api?.length) {
        out.push("  API:");
        for (const p of e.api) {
            const req = p.required ? " (required)" : p.default !== undefined ? ` = ${JSON.stringify(p.default)}` : "";
            out.push(`    ${p.prop}: ${p.type}${req}`);
        }
    }

    if (e.composedOf?.length) out.push(`  Built from: ${e.composedOf.join(" · ")}`);

    out.push("  States:");
    for (const [k, v] of Object.entries(e.states ?? {})) {
        out.push(v === null ? `    ${k}: — (${e.statesOmittedWhy?.[k] ?? "NO REASON GIVEN"})` : `    ${k}: ${v}`);
    }

    out.push(`  Skeleton: shape ${e.skeleton?.shape ?? "—"}, mirror ${e.skeleton?.mirrors ?? "—"}`);
    if (e.tokens) out.push(`  Token: ${Object.entries(e.tokens).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
    if (e.forbidden?.length) out.push("  Forbidden:", ...e.forbidden.map((f) => `    - ${f}`));

    const decided = Object.values(e.verdict?.axes ?? {}).filter(Boolean).length;
    out.push(`  Verdict: ${decided}/${AXES} axes (${e.verdict?.date ?? "no date yet"})`);
    return out.join("\n");
}

function gaps(e) {
    const g = [];
    if (e.tier === "foundations") {
        if (!e.scale?.length) g.push("no scale");
        if (!e.readBy?.length) g.push("no axis reads it");
        for (const s of e.scale ?? []) if (!s.derived) g.push(`step ${s.step} does not say how it is derived`);
        return g;
    }
    if (!e.skeleton?.shape) g.push("missing skeleton");
    for (const [k, v] of Object.entries(e.states ?? {})) {
        if (v === null && !e.statesOmittedWhy?.[k]) g.push(`state ${k} is empty with no reason`);
    }
    const decided = Object.values(e.verdict?.axes ?? {}).filter(Boolean).length;
    if (decided < AXES) g.push(`verdict ${decided}/${AXES}`);
    return g;
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const rest = args.filter((a) => a !== "--json");
const entries = load();

if (!entries.length) {
    console.log("Library is empty - no entries admitted yet. Run starci-fe-story-audit-block and propose one.");
    process.exit(0);
}

if (rest[0] === "--tier") {
    const hits = entries.filter((e) => e.tier === rest[1]);
    console.log(hits.length ? hits.map((e) => `${e.name.padEnd(24)} ${e.role}`).join("\n") : `Tier ${rest[1]} is empty.`);
} else if (rest[0] === "--missing") {
    let clean = true;
    for (const e of entries) {
        const g = gaps(e);
        if (g.length) { clean = false; console.log(`${e.name.padEnd(24)} ${g.join(" · ")}`); }
    }
    if (clean) console.log("Every entry has full skeleton, full states, and all 15 verdicts.");
} else if (rest.length) {
    const q = rest.join(" ").toLowerCase();
    const hits = entries.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        (e.role ?? "").toLowerCase().includes(q) ||
        (e.file ?? "").toLowerCase().includes(q));
    if (!hits.length) {
        console.log(`No entry matches "${rest.join(" ")}".`);
        console.log("The library not having it does not mean you get to improvise - propose an entry as a widget.");
        process.exit(1);
    }
    console.log(asJson ? JSON.stringify(hits, null, 2) : hits.map(fmt).join("\n\n"));
} else {
    const byTier = {};
    for (const e of entries) (byTier[e.tier] ??= []).push(e.name);
    for (const [t, names] of Object.entries(byTier)) console.log(`${t.padEnd(12)} ${names.length}  ${names.join(" · ")}`);
}
