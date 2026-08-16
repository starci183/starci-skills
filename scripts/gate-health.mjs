// gate-health — the termination test for the refactor loop.
//
// The loop stops when a gate has no CONFLICT and no GUESS left. Both words have to mean something a
// script can count, or every round ends in an argument about whether it is done.
//
//   CONFLICT  two laws that rule differently on one situation, plus the cheaper structural kinds:
//             a routing row with no owner, a link to a file that is not there, a module missing a
//             record, an anchor pointing at the dead repository.
//   GUESS     a line a blind agent had to invent because the gate said nothing — collected from the
//             `GATE IM LẶNG Ở ĐÂU` section of every proof.
//
// Run from the trust root:  node scripts/gate-health.mjs [--json]

import {readdir, readFile, stat} from "node:fs/promises";
import {existsSync} from "node:fs";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATES = ["layouts", "blocks", "principles", "patterns", "lints"];
const RECORDS = ["INDEX.md", "vi.md", "example.md", "audit.md", "changelog.md"];

// A module may sit at the shelf root or inside one family folder. Two levels is the whole shape.
async function modulesOf(shelf) {
  const root = join(trustRoot, "fe", shelf);
  if (!existsSync(root)) return [];
  const found = [];
  for (const entry of await readdir(root, {withFileTypes: true})) {
    if (!entry.isDirectory() || entry.name === "proofs") continue;
    const here = join(root, entry.name);
    const names = await readdir(here);
    if (names.includes("INDEX.md")) {
      found.push({id: entry.name, dir: here, names});
      continue;
    }
    for (const inner of await readdir(here, {withFileTypes: true})) {
      if (!inner.isDirectory()) continue;
      const deep = join(here, inner.name);
      found.push({id: `${entry.name}/${inner.name}`, dir: deep, names: await readdir(deep)});
    }
  }
  return found;
}

async function everyMarkdown(dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const here = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await everyMarkdown(here)));
    else if (entry.name.endsWith(".md")) out.push(here);
  }
  return out;
}

// `.workflows/designs/starci-academy/...` is a record path and legitimate. A source anchor into the
// retired checkout is not, and the whole shelf was re-anchored once already to get rid of them.
const DEAD_REPO = /Repositories[\\/]starci-academy[\\/](?!.*\.workflows)/i;

async function auditGate(shelf) {
  const root = join(trustRoot, "fe", shelf);
  const report = {
    shelf,
    exists: existsSync(root),
    modules: 0,
    missingRecords: [],
    brokenLinks: [],
    danglingRows: [],
    deadRepoAnchors: [],
    unanchored: 0,
    guesses: [],
    conflicts: [],
  };
  if (!report.exists) return report;

  const modules = await modulesOf(shelf);
  report.modules = modules.length;

  for (const module of modules) {
    for (const record of RECORDS) {
      if (!module.names.includes(record)) report.missingRecords.push(`${shelf}/${module.id}: ${record}`);
    }
  }

  for (const file of await everyMarkdown(root)) {
    const source = await readFile(file, "utf8");
    const shown = relative(trustRoot, file).replace(/\\/g, "/");

    for (const [, target] of source.matchAll(/\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)) {
      if (/^https?:/.test(target)) continue;
      if (!existsSync(resolve(dirname(file), target))) report.brokenLinks.push(`${shown} -> ${target}`);
    }

    for (const [, path] of source.matchAll(/`?([A-Z]:[\\/][^`\s)]+)`?/g)) {
      if (DEAD_REPO.test(path)) report.deadRepoAnchors.push(`${shown} -> ${path}`);
    }

    // A routing row that names no owner is a law the shelf claims and does not hold.
    //
    // Scope matters more than the test here. Two earlier versions counted every table in every file:
    // the first flagged any line containing `owed` and reported eighteen where three were real, since
    // plenty of rules correctly RESOLVE to `owed`; the second flagged any empty cell and reported a
    // hundred and forty-nine, since `—` is ordinary content in a data table. Only the shelf INDEX
    // routes, and only a table with an owner column is a routing table.
    if (file === join(root, "INDEX.md")) {
      const lines = source.split(/\r?\n/);
      let ownerColumn = -1;
      for (const line of lines) {
        if (!line.startsWith("|")) {
          ownerColumn = -1;
          continue;
        }
        const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
        if (ownerColumn === -1) {
          ownerColumn = cells.findIndex((cell) => /^(owner module|module|owner)$/i.test(cell));
          continue;
        }
        if (/^-+$/.test(cells[0] ?? "")) continue;
        const owner = cells[ownerColumn] ?? "";
        const empty = owner === "" || owner === "—" || owner === "-" || /^\*{0,2}(owed|tbd|no module)\*{0,2}$/i.test(owner);
        if (empty) report.danglingRows.push(`${shown}: ${line.trim().slice(0, 90)}`);
      }
    }

    report.unanchored += (source.match(/suy lu[âậ]n, kh[ôo]ng c[óo] neo/gi) || []).length;

    // Only a level-two heading, anchored to the line start. `### Mâu thuẫn … bảo toàn cả hai` sits
    // under `## Rủi ro còn mở` and records a tension deliberately kept — that is a decision, not an
    // open conflict, and an unanchored pattern matched it by starting one character in.
    for (const [, body] of source.matchAll(/^## (?:Mâu thuẫn|Conflict)[^\n]*\n([\s\S]*?)(?=\n#{1,3} |$)/gim)) {
      for (const line of body.split(/\r?\n/)) {
        const text = line.trim();
        if (text.startsWith("- ") || text.startsWith("* ")) report.conflicts.push(`${shown}: ${text.slice(2, 110)}`);
      }
    }
  }

  const proofs = join(root, "proofs");
  if (existsSync(proofs)) {
    for (const file of await everyMarkdown(proofs)) {
      const source = await readFile(file, "utf8");
      const shown = relative(trustRoot, file).replace(/\\/g, "/");
      for (const [, body] of source.matchAll(/##\s*GATE IM L[ĂẶ]NG[^\n]*\n([\s\S]*?)(?=\n##\s|$)/gi)) {
        for (const line of body.split(/\r?\n/)) {
          const text = line.trim();
          if (text.startsWith("- ") || text.startsWith("* ") || /^\d+\./.test(text)) {
            report.guesses.push(`${shown}: ${text.replace(/^[-*]\s*|\d+\.\s*/, "").slice(0, 110)}`);
          }
        }
      }
    }
  }

  return report;
}

const reports = [];
for (const shelf of GATES) reports.push(await auditGate(shelf));

const total = (key) => reports.reduce((sum, report) => sum + report[key].length, 0);
const conflictCount =
  total("brokenLinks") + total("danglingRows") + total("missingRecords") + total("deadRepoAnchors") + total("conflicts");
const guessCount = total("guesses");
const clean = conflictCount === 0 && guessCount === 0;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({clean, conflictCount, guessCount, reports}, null, 2));
} else {
  console.log("gate            module  link  row  record  deadrepo  conflict  guess  suy-luan");
  for (const r of reports) {
    console.log(
      String(r.shelf).padEnd(15) +
        String(r.exists ? r.modules : "-").padStart(6) +
        String(r.brokenLinks.length).padStart(6) +
        String(r.danglingRows.length).padStart(5) +
        String(r.missingRecords.length).padStart(8) +
        String(r.deadRepoAnchors.length).padStart(10) +
        String(r.conflicts.length).padStart(10) +
        String(r.guesses.length).padStart(7) +
        String(r.unanchored).padStart(10)
    );
  }
  console.log("");
  for (const r of reports) {
    const rows = [
      ...r.missingRecords.map((x) => ["thiếu record", x]),
      ...r.brokenLinks.map((x) => ["link vỡ", x]),
      ...r.danglingRows.map((x) => ["dòng treo", x]),
      ...r.deadRepoAnchors.map((x) => ["neo repo chết", x]),
      ...r.conflicts.map((x) => ["mâu thuẫn", x]),
      ...r.guesses.map((x) => ["đoán", x]),
    ];
    if (!rows.length) continue;
    console.log(`--- ${r.shelf} ---`);
    for (const [kind, text] of rows) console.log(`  ${kind.padEnd(14)} ${text}`);
  }
  console.log("");
  console.log(clean ? "SẠCH — không conflict, không guess." : `CHƯA — ${conflictCount} conflict · ${guessCount} guess.`);
}

process.exit(clean ? 0 : 1);
