#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const findings = [];
const packageCache = new Map();

function report(file, line, message) {
  findings.push(`${relative(root, file).split(sep).join("/")}:${line}: ${message}`);
}

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "docs") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files.sort();
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function sectionEnd(lines, start) {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^## (?!#)/.test(lines[index])) return index;
  }
  return lines.length;
}

function parseLoads(file, lines) {
  const h1 = lines.findIndex((line) => /^# (?!#)/.test(line));
  if (h1 < 0) {
    report(file, 1, "missing document title");
    return { rows: [], start: -1, end: -1 };
  }

  let first = h1 + 1;
  while (first < lines.length && lines[first].trim() === "") first += 1;
  if (lines[first] !== "## LOADS") {
    report(file, first + 1, "LOADS must be the first section after the title");
    return { rows: [], start: -1, end: -1 };
  }

  const duplicates = lines
    .map((line, index) => (line === "## LOADS" ? index : -1))
    .filter((index) => index >= 0);
  if (duplicates.length !== 1) report(file, first + 1, "LOADS must appear exactly once");

  const end = sectionEnd(lines, first);
  const rows = [];
  const aliases = new Set();
  const targets = new Set();
  const rowPattern = /^\| `(@[a-z][a-z0-9-]*)` \| `([^`]+)` \| (module|script|file|npm package|URL) \| ([^|]+) \|$/;
  for (let index = first + 1; index < end; index += 1) {
    const line = lines[index];
    if (!line.startsWith("| `@")) continue;
    const match = line.match(rowPattern);
    if (!match) {
      report(file, index + 1, "malformed LOADS row");
      continue;
    }
    const [, alias, target, kind, why] = match;
    if (aliases.has(alias)) report(file, index + 1, `duplicate alias ${alias}`);
    if (targets.has(target)) report(file, index + 1, `target ${target} declared more than once`);
    if (!why.trim()) report(file, index + 1, `missing Why for ${alias}`);
    aliases.add(alias);
    targets.add(target);
    rows.push({ alias, target, kind, line: index + 1 });
  }

  const hasNone = lines.slice(first + 1, end).some((line) => line.trim() === "None.");
  if (rows.length === 0 && !hasNone) report(file, first + 1, "empty LOADS must say None.");
  if (rows.length > 0 && hasNone) report(file, first + 1, "LOADS cannot contain rows and None.");
  return { rows, start: first, end };
}

function npmBase(target) {
  if (target.startsWith("@")) return target.split("/").slice(0, 2).join("/");
  return target.split("/")[0];
}

function resolveTarget(file, row) {
  const { alias, target, kind, line } = row;
  if (kind === "module" || kind === "file" || kind === "script") {
    const path = resolve(root, target);
    if (!existsSync(path)) {
      report(file, line, `dead target for ${alias}: ${target}`);
      return;
    }
    if (kind === "module" && !statSync(path).isDirectory()) {
      report(file, line, `module target is not a directory: ${target}`);
    }
    if ((kind === "file" || kind === "script") && !statSync(path).isFile()) {
      report(file, line, `${kind} target is not a file: ${target}`);
    }
    if (kind === "script" && !target.endsWith(".mjs")) {
      report(file, line, `script target must be an .mjs file: ${target}`);
    }
    return;
  }

  if (kind === "URL") {
    try {
      const url = new URL(target);
      if (!/^https?:$/.test(url.protocol)) throw new Error("protocol");
      const command = process.platform === "win32" ? "curl.exe" : "curl";
      execFileSync(command, ["--fail", "--silent", "--show-error", "--location", "--head", "--max-time", "15", target], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20_000,
      });
    } catch {
      report(file, line, `unresolvable URL target for ${alias}: ${target}`);
    }
    return;
  }

  const base = npmBase(target);
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/.test(base)) {
    report(file, line, `invalid npm package target for ${alias}: ${target}`);
    return;
  }
  if (!packageCache.has(base)) {
    try {
      if (process.platform === "win32") {
        execFileSync("cmd.exe", ["/d", "/s", "/c", `npm view ${base} version --silent`], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 20_000,
        });
      } else {
        execFileSync("npm", ["view", base, "version", "--silent"], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 20_000,
        });
      }
      packageCache.set(base, true);
    } catch {
      packageCache.set(base, false);
    }
  }
  if (!packageCache.get(base)) report(file, line, `unresolvable npm package target: ${base}`);
}

function withoutSections(lines, sections) {
  return lines
    .map((line, index) => (sections.some(({ start, end }) => index >= start && index < end) ? "" : line))
    .join("\n");
}

function parseHands(file, lines, loads, isSkill) {
  const heading = "## HANDS OFF TO — named, never loaded";
  const positions = lines
    .map((line, index) => (line === heading ? index : -1))
    .filter((index) => index >= 0);
  if (!isSkill) {
    if (positions.length) report(file, positions[0] + 1, "only skills may declare HANDS OFF TO");
    return { names: [], start: -1, end: -1 };
  }
  if (positions.length !== 1) {
    report(file, loads.end + 1, "skills must declare HANDS OFF TO exactly once");
    return { names: [], start: -1, end: -1 };
  }
  const start = positions[0];
  if (start !== loads.end) report(file, start + 1, "HANDS OFF TO must immediately follow LOADS");
  const end = sectionEnd(lines, start);
  const content = lines.slice(start + 1, end).join("\n");
  const names = [...content.matchAll(/`(starci-[a-z-]+)`/g)].map((match) => match[1]);
  if (new Set(names).size !== names.length) report(file, start + 1, "duplicate HANDS OFF TO name");
  if (names.length === 0 && !lines.slice(start + 1, end).some((line) => line.trim() === "None.")) {
    report(file, start + 1, "empty HANDS OFF TO must say None.");
  }
  return { names, start, end };
}

function tableAllowsSkill(lines, index, skill) {
  if (!lines[index].startsWith("|")) return false;
  let top = index;
  while (top > 0 && lines[top - 1].startsWith("|")) top -= 1;
  const headers = lines[top].split("|").slice(1, -1).map((cell) => cell.trim().toLowerCase());
  const cells = lines[index].split("|").slice(1, -1).map((cell) => cell.trim());
  return cells.some((cell, cellIndex) =>
    cell.includes(skill) && /^(owner|cleared by|fixed by)$/.test(headers[cellIndex] ?? ""),
  );
}

function validateSkillNames(file, lines, hands) {
  const own = dirname(file).split(sep).at(-1);
  let section = "";
  const seen = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    if (/^## /.test(lines[index])) section = lines[index];
    for (const match of lines[index].matchAll(/starci-[a-z-]+/g)) {
      const name = match[0];
      if (name === own || (index >= hands.start && index < hands.end)) continue;
      seen.add(name);
      const stop = section === "## Stops" && /^\s*- /.test(lines[index]);
      const owner = tableAllowsSkill(lines, index, name);
      if (!stop && !owner) report(file, index + 1, `copied law: ${name} is outside a Stop row or owner cell`);
      if (!hands.names.includes(name)) report(file, index + 1, `${name} is missing from HANDS OFF TO`);
      if (/\b(?:read|load|open|invoke|run)\b/i.test(lines[index])) {
        report(file, index + 1, `level violation: HANDS OFF TO target ${name} is described as loaded`);
      }
    }
  }
  for (const name of hands.names) {
    if (!seen.has(name)) report(file, hands.start + 1, `dead HANDS OFF TO name: ${name}`);
  }
}

function validateBody(file, lines, loads, hands, knownAliases) {
  const body = withoutSections(lines, [loads, hands].filter(({ start }) => start >= 0));
  for (const row of loads.rows) {
    const pattern = new RegExp(`(^|[^a-z0-9-])${row.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9-]|/)`, "g");
    const matches = [...body.matchAll(pattern)];
    if (matches.length === 0) report(file, row.line, `dead LOADS row: ${row.alias}`);
  }

  const declared = new Set(loads.rows.map(({ alias }) => alias));
  for (const match of body.matchAll(/(^|[^\w/])(@[a-z][a-z0-9-]*)(?![a-z0-9-]|\/)/gm)) {
    const alias = match[2];
    if (knownAliases.has(alias) && !declared.has(alias)) {
      report(file, lineAt(body, match.index), `smuggled alias: ${alias}`);
    }
  }

  const forbidden = [
    { pattern: /(?<!\!)\[[^\]]+\]\((?:\.{1,2}\/|https?:\/\/|<tree>\/)[^)]+\)/g, label: "outside Markdown link" },
    { pattern: /@starci\/eslint-canon-(?:fe|be)(?:\/[a-z-]+)?/g, label: "undeclared npm package" },
    { pattern: /<trust>\/scripts\/[a-z0-9.-]+\.mjs/g, label: "undeclared script" },
    { pattern: /(?:contexts|brainstorms|compilers|gates|skills)\/[a-z0-9*<>._/-]+/g, label: "undeclared tree module" },
    { pattern: /https?:\/\/[^\s)`]+/g, label: "undeclared URL" },
  ];
  for (const { pattern, label } of forbidden) {
    for (const match of body.matchAll(pattern)) report(file, lineAt(body, match.index), `${label}: ${match[0].trim()}`);
  }
}

function outline(lines) {
  return lines
    .filter((line) => /^#{2,6} /.test(line))
    .map((line) => line.match(/^#+/)[0].length);
}

function aliasesFor(rows) {
  return rows.map(({ alias, target, kind }) => `${alias}\0${target}\0${kind}`);
}

const files = markdownFiles(root);
const parsed = new Map();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const loads = parseLoads(file, lines);
  const isSkill = /[\\/]skills[\\/]starci-[^\\/]+[\\/]SKILL\.md$/.test(file);
  const hands = parseHands(file, lines, loads, isSkill);
  parsed.set(file, { lines, loads, hands, isSkill });
}

const knownAliases = new Set(
  [...parsed.values()].flatMap(({ loads }) => loads.rows.map(({ alias }) => alias)),
);
for (const [file, record] of parsed) {
  const { lines, loads, hands, isSkill } = record;
  loads.rows.forEach((row) => resolveTarget(file, row));
  validateBody(file, lines, loads, hands, knownAliases);
  if (isSkill) validateSkillNames(file, lines, hands);
  for (let index = 0; index < lines.length; index += 1) {
    if (/^### [0-9]+[a-z] —/.test(lines[index])) report(file, index + 1, "patched step label");
  }
}

for (const [file, en] of parsed) {
  if (!file.endsWith(`${sep}en.md`)) continue;
  const viPath = join(dirname(file), "vi.md");
  const vi = parsed.get(viPath);
  if (!vi) {
    report(file, 1, "missing vi.md peer");
    continue;
  }
  if (JSON.stringify(aliasesFor(en.loads.rows)) !== JSON.stringify(aliasesFor(vi.loads.rows))) {
    report(viPath, vi.loads.start + 1, "LOADS aliases, targets or kinds differ from en.md");
  }
  if (JSON.stringify(outline(en.lines)) !== JSON.stringify(outline(vi.lines))) {
    report(viPath, 1, "section count or order differs from en.md");
  }
  const codes = (lines) => [...new Set(lines.join("\n").match(/\b[A-Z][A-Z0-9-]*-[0-9]+\b/g) ?? [])].sort();
  if (JSON.stringify(codes(en.lines)) !== JSON.stringify(codes(vi.lines))) {
    report(viPath, 1, "situation codes differ from en.md");
  }
  const fixed = ["### CONTEXT", "### OUTPUTS", "### CHANGES", "### NEED APPROVALS", "### WARNINGS", "### REJECTED", "### OWED"];
  for (const heading of fixed) {
    const enHas = en.lines.includes(heading);
    const viHas = vi.lines.includes(heading);
    if (enHas !== viHas) report(viPath, 1, `fixed output heading mismatch: ${heading}`);
  }
  for (let index = 0; index < vi.lines.length; index += 1) {
    if (/^### (?:KẾT QUẢ|CẢNH BÁO|THAY ĐỔI)\b/.test(vi.lines[index])) {
      report(viPath, index + 1, "translated fixed output heading");
    }
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  console.error(`\n${findings.length} finding(s)`);
  process.exit(1);
}

console.log(`Dependency contract holds for ${files.length} Markdown files.`);
