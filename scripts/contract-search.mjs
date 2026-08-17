// Answer one need against a project's contract registry, and return the three fields a layout stage may
// see. Read-only: it opens nothing, writes nothing, and resolves the registry through the workspace route
// so no disk path lives in this tree.
//
//   node .claude/scripts/contract-search.mjs <project> <role> --need "<one need sentence>"
//
// WHY A SCRIPT AND NOT A READ. The registry measured here is 192KB across 299 entries; the fields a layout
// stage may see are a third of it, and a query answers in under 2KB. The saving is the small half of it.
// The large half is that `classes` is never extracted at all, so the read ceiling is a property of this
// program rather than a promise a stage makes about what it looked at.
//
// A query that matches nothing exits 1 and says so. That is not a failure of the search: it means no
// entry states this need, which is at once a `new` verdict for the caller and a finding about the index.

import {existsSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1] ?? null;
};
const [project, role] = args.filter((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true);
const need = flag("--need");
const limit = Number(flag("--limit") ?? 5);
const asJson = args.includes("--json");

if (!project || !role || !need) {
  console.error('usage: contract-search.mjs <project> <role> --need "<one need sentence>" [--limit 5] [--json]');
  console.error('  e.g. contract-search.mjs example-app fe --need "a row comparing a name with one stored value"');
  process.exit(2);
}

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const route = join(source, ".workspace", project, role, "config.json");
if (!existsSync(route)) {
  console.error(`no route at .workspace/${project}/${role}/config.json — WORKSPACE-2, return to starci-init`);
  process.exit(2);
}

let contract;
try {
  contract = JSON.parse(readFileSync(route, "utf8")).context?.contract ?? null;
} catch (error) {
  console.error(`route is not valid JSON — ${error.message}`);
  process.exit(2);
}

// Parsing is not verifying: a route naming a contract that is no longer there is stale, and stale is
// answered by starci-init rather than by searching whatever else is on the disk.
if (!contract) {
  console.error(`${project}/${role} records no contract — WORKSPACE-4, and for a frontend role that is stale`);
  process.exit(2);
}
if (!existsSync(contract)) {
  console.error(`recorded contract path no longer exists — WORKSPACE-5, return to starci-init`);
  process.exit(2);
}

const text = readFileSync(contract, "utf8");

/*
 * Three fields, and `classes` is not one of them. A stage that cannot see a class cannot write one, which
 * is the whole reason layout resolves regions here instead of reading the registry: the boundary holds
 * because the value never arrives, not because the caller was asked not to look at it.
 */
const entries = [];
const entryStart = /^\s{4}"([a-z0-9-]+)":\s*\{/gm;
let match;
while ((match = entryStart.exec(text))) {
  const from = match.index;
  const next = text.indexOf('\n    "', from + match[0].length);
  const body = text.slice(from, next === -1 ? text.length : next);
  entries.push({
    key: match[1],
    why: body.match(/why:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? null,
    host: body.match(/host:\s*"([^"]*)"/)?.[1] ?? null,
  });
}

if (entries.length === 0) {
  console.error(`no entries parsed from ${contract} — the registry shape changed, and this script is the thing that is wrong`);
  process.exit(2);
}

const STOP = new Set(["a", "an", "the", "of", "on", "in", "to", "and", "or", "with", "for", "is", "it", "its", "one", "you", "your", "need", "needs", "if", "that", "this", "same", "each", "every", "so", "than", "then", "there", "their", "them"]);
const tokens = (value) => (value ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP.has(word));

/*
 * A single incidental word is not an answer. "countdown until the next attempt unlocks" matches
 * `content-next-row` on the word `next` and on nothing else, and a result like that reported as a hit is
 * precisely the failure this script exists to remove: a stage seeing something that looks close enough.
 * So a hit must carry at least two of the asked words, or a quarter of them — and every result prints the
 * words it matched on, because a score with no words behind it cannot be argued with.
 */
const answers = (hit, asked) => hit.score >= 2 || hit.score / Math.max(1, asked.length) >= 0.25;

const asked = tokens(need);
const hits = entries
  .map((entry) => {
    const haystack = new Set([...tokens(entry.why), ...tokens(entry.key)]);
    const matched = asked.filter((word) => haystack.has(word));
    return {...entry, score: matched.length, matched};
  })
  .filter((entry) => entry.score > 0)
  .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
  .slice(0, Math.max(1, limit));

const scanned = entries.length;
const reasons = entries.filter((entry) => entry.why).length;

const answered = hits.filter((hit) => answers(hit, asked));

if (asJson) {
  console.log(JSON.stringify({project, role, need, scanned, reasons, answered: answered.length, hits: hits.map(({key, why, host, score, matched}) => ({key, why, host, score, matched, answers: answers({score}, asked)}))}, null, 2));
} else {
  // Say what was scanned, or five results read as "there are five".
  console.log(`scanned ${scanned} entries · ${reasons} carry a reason · registry not loaded into this answer`);
  console.log(`need: "${need}"\n`);
  if (hits.length === 0) console.log("nothing matched a single word of this need");
  for (const hit of hits) {
    const mark = answers(hit, asked) ? " " : "~";
    console.log(`${mark} ${hit.score}  ${hit.key}${hit.host ? `  [host ${hit.host}]` : ""}   on: ${hit.matched.join(", ")}`);
    console.log(`       why: ${hit.why ?? "(no reason recorded — the entry cannot be found by need at all)"}`);
  }
  if (answered.length === 0 && hits.length > 0) console.log("\n~ = matched on an incidental word, not on the need");
}

if (answered.length === 0) {
  console.error("\n→ verdict `new`, and record the miss: starci-repair, the `why` pass, needs the need that");
  console.error("  no entry answered. An index that cannot answer a real surface is stale while every gate is green.");
  process.exit(1);
}
