#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { checkContextFile } from "./compile-context.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "--all";
const modeLanes = new Map([
  ["--all", ["context", "en", "vi"]],
  ["--context", ["context"]],
  ["--en", ["en"]],
  ["--vi", ["vi"]],
]);
if (!modeLanes.has(mode) || process.argv.length > 3) {
  console.error("Usage: node scripts/check-deps.mjs [--all|--context|--en|--vi]");
  process.exit(2);
}
const selectedLanes = new Set(modeLanes.get(mode));
const findings = { context: [], en: [], vi: [] };
const packageCache = new Map();
const ignoredRuntimeDirectories = new Set([".git", ".claude", ".testtmp", "docs", "node_modules", "worktrees", "sessions", "cache"]);

function laneFor(file) {
  if (file.endsWith(`${sep}context.md`) || file.endsWith(`${sep}SKILL.md`) || file === join(root, "INDEX.md")) return "context";
  if (file.endsWith(`${sep}en.md`)) return "en";
  if (file.endsWith(`${sep}vi.md`)) return "vi";
  return null;
}

function report(file, line, message) {
  const lane = laneFor(file);
  if (!lane || !selectedLanes.has(lane)) return;
  findings[lane].push(`${relative(root, file).split(sep).join("/")}:${line}: ${message}`);
}

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredRuntimeDirectories.has(entry.name)) continue;
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

function parseLoads(file, lines, lane) {
  const runtime = lane === "context";
  const h1 = lines.findIndex((line) => /^# (?!#)/.test(line));
  if (h1 < 0) {
    report(file, 1, "missing document title");
    return { rows: [], start: -1, end: -1 };
  }

  let first = h1 + 1;
  while (first < lines.length && lines[first].trim() === "") first += 1;
  if (!runtime) first = lines.findIndex((line) => line === "## LOADS");
  if (first < 0 || lines[first] !== "## LOADS") {
    if (runtime) report(file, Math.max(first + 1, 1), "LOADS must be the first section after the title");
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
  const rowPattern = /^\| `(@[a-z][a-z0-9-]*)` \| `([^`]+)` \| (module|context|en|vi|script|file|npm package|URL) \| ([^|]+) \|$/;
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

  const hasNone = lines.slice(first + 1, end).some((line) => /^(?:None|Không có)\./.test(line.trim()));
  if (rows.length === 0 && !hasNone) report(file, first + 1, "empty LOADS must say None.");
  if (rows.length > 0 && hasNone) report(file, first + 1, "LOADS cannot contain rows and None.");
  return { rows, start: first, end };
}

function npmBase(target) {
  if (target.startsWith("@")) return target.split("/").slice(0, 2).join("/");
  return target.split("/")[0];
}

function resolveTarget(file, row, lane) {
  const { alias, target, kind, line } = row;
  if (kind === "module") {
    if (lane === "context") {
      report(file, line, `runtime graph cannot load a directory module: ${target}`);
      return;
    }
    const path = resolve(root, target);
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      report(file, line, `dead publication module for ${alias}: ${target}`);
      return;
    }
    const publicationName = `${lane}.md`;
    const hasPublication = readdirSync(path, { recursive: true, withFileTypes: true })
      .some((entry) => entry.isFile() && entry.name === publicationName);
    if (!hasPublication) report(file, line, `${lane} publication module has no ${publicationName}: ${target}`);
    return;
  }
  if (kind === "context" || kind === "en" || kind === "vi" || kind === "file" || kind === "script") {
    const path = resolve(root, target);
    if (!existsSync(path)) {
      report(file, line, `dead target for ${alias}: ${target}`);
      return;
    }
    if (!statSync(path).isFile()) {
      report(file, line, `${kind} target is not a file: ${target}`);
    }
    const expectedKind = lane === "context" ? "context" : lane;
    if (["context", "en", "vi"].includes(kind) && kind !== expectedKind) {
      report(file, line, `${lane} graph cannot load ${kind} target: ${target}`);
    }
    if (["context", "en", "vi"].includes(kind) && !target.endsWith(`/${kind}.md`)) {
      report(file, line, `${kind} target must end in /${kind}.md: ${target}`);
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

function parseNested(file, lines, loads, isSkill) {
  const heading = "## NESTED SKILLS";
  const positions = lines
    .map((line, index) => (line === heading ? index : -1))
    .filter((index) => index >= 0);
  if (!isSkill) {
    if (positions.length) report(file, positions[0] + 1, "only skills may declare NESTED SKILLS");
    return { start: -1, end: -1 };
  }
  if (positions.length !== 1) {
    report(file, loads.end + 1, "skills must declare NESTED SKILLS exactly once");
    return { start: -1, end: -1 };
  }
  const start = positions[0];
  if (start !== loads.end) report(file, start + 1, "NESTED SKILLS must immediately follow LOADS");
  const end = sectionEnd(lines, start);
  const content = lines.slice(start + 1, end).join("\n");
  const names = [...content.matchAll(/`(starci-[a-z-]+)`/g)].map((match) => match[1]);
  if (names.length) report(file, start + 1, "NESTED SKILLS must be None; skills never invoke skills");
  if (!lines.slice(start + 1, end).some((line) => /^(?:None|Không có)\./.test(line.trim()))) {
    report(file, start + 1, "NESTED SKILLS must explicitly say None.");
  }
  return { start, end };
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

function validateSkillNames(file, lines, nested) {
  const own = dirname(file).split(sep).at(-1);
  let section = "";
  const seen = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    if (/^## /.test(lines[index])) section = lines[index];
    for (const match of lines[index].matchAll(/starci-[a-z-]+/g)) {
      const name = match[0];
      if (name === own || (index >= nested.start && index < nested.end)) continue;
      seen.add(name);
      const stop = (section === "## Stops" || section === "## Điểm dừng") && /^\s*- /.test(lines[index]);
      const owner = tableAllowsSkill(lines, index, name);
      if (!stop && !owner) report(file, index + 1, `copied law: ${name} is outside a Stop row or owner cell`);
      if (!owner && /\b(?:read|load|open|invoke|run|start|call|route|handover)\b|\bhand\s+over\b|\breturn\s+to\b|\b(?:gọi|chạy|chuyển|route|trả về)\b/iu.test(lines[index])) {
        report(file, index + 1, `nested skill invocation: ${name}`);
      }
    }
  }
}

function validateBody(file, lines, loads, nested, lane) {
  const body = withoutSections(lines, [loads, nested].filter(({ start }) => start >= 0));
  const expectedName = lane === "context" ? "context.md" : `${lane}.md`;
  for (const match of body.matchAll(/\[[^\]]+\]\(([^)]+\.md)(?:#[^)]+)?\)/g)) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^https?:\/\//.test(target)) continue;
    const targetPath = resolve(dirname(file), target);
    if (!existsSync(targetPath)) report(file, lineAt(body, match.index), `dead ${lane} Markdown link: ${target}`);
    else if (basename(targetPath) !== expectedName) {
      report(file, lineAt(body, match.index), `${lane} graph crosses into ${basename(targetPath)}: ${target}`);
    }
  }
  for (const match of body.matchAll(/`([^`\n]*\/(context|en|vi)\.md)`/g)) {
    const [, target, targetLane] = match;
    if (target.includes("<")) continue;
    const expectedLane = lane === "context" ? "context" : lane;
    if (targetLane !== expectedLane) {
      report(file, lineAt(body, match.index), `${lane} graph crosses into ${targetLane}.md: ${target}`);
      continue;
    }
    const rootPath = resolve(root, target);
    const relativePath = resolve(dirname(file), target);
    if (!existsSync(rootPath) && !existsSync(relativePath)) {
      report(file, lineAt(body, match.index), `dead ${lane} record path: ${target}`);
    }
  }
}

function outline(lines) {
  return lines
    .filter((line) => /^#{2,6} /.test(line))
    .map((line) => line.match(/^#+/)[0].length);
}

function aliasesFor(rows) {
  return rows.map(({ alias, target, kind }) => {
    const logicalTarget = target.replace(/\/(?:context|en|vi)\.md$/, "");
    const logicalKind = ["module", "context", "en", "vi"].includes(kind) ? "record" : kind;
    return `${alias}\0${logicalTarget}\0${logicalKind}`;
  });
}

const files = markdownFiles(root).filter((file) => laneFor(file));
const parsed = new Map();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const isSkill = /[\\/]skills[\\/]starci-[^\\/]+[\\/](?:SKILL|en|vi)\.md$/.test(file);
  const isBindingSkill = /[\\/]skills[\\/]starci-[^\\/]+[\\/]SKILL\.md$/.test(file);
  const isRuntimeModule = file.endsWith(`${sep}context.md`);
  const lane = laneFor(file);
  const loads = parseLoads(file, lines, lane);
  const nested = parseNested(file, lines, loads, isSkill);
  parsed.set(file, { lines, loads, nested, lane, isSkill, isBindingSkill, isRuntimeModule });
}

for (const [file, record] of parsed) {
  const { lines, loads, nested, lane, isSkill } = record;
  if (!selectedLanes.has(lane)) continue;
  loads.rows.forEach((row) => resolveTarget(file, row, lane));
  validateBody(file, lines, loads, nested, lane);
  if (isSkill) validateSkillNames(file, lines, nested);
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
    report(viPath, Math.max(vi.loads.start + 1, 1), "LOADS logical dependencies differ from en.md");
  }
  if (JSON.stringify(outline(en.lines)) !== JSON.stringify(outline(vi.lines))) {
    report(viPath, 1, "section count or order differs from en.md");
  }
  const codes = (lines) => [...new Set(
    [...lines.join("\n").matchAll(/^\| `([A-Z][A-Z0-9-]*-[0-9]+)` \|/gm)].map((match) => match[1]),
  )].sort();
  if (JSON.stringify(codes(en.lines)) !== JSON.stringify(codes(vi.lines))) {
    report(viPath, 1, "situation codes differ from en.md");
  }
  const fixed = ["### NEED APPROVALS"];
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
  const runtime = checkContextFile(file);
  if (!existsSync(join(dirname(file), "SKILL.md")) && !runtime.ok) report(runtime.contextPath, 1, runtime.reason);
}

for (const [file, skill] of parsed) {
  if (!/[\\/]skills[\\/]starci-[^\\/]+[\\/]SKILL\.md$/.test(file)) continue;
  if (!skill.loads.rows.some(({alias}) => alias === "@skill-shape")) {
    report(file, Math.max(skill.loads.start + 1, 1), "every StarCi skill must load @skill-shape for shared step-table and approval control");
  }
  const viPath = join(dirname(file), "vi.md");
  const vi = parsed.get(viPath);
  if (!vi) {
    report(file, 1, "missing Vietnamese skill record");
    continue;
  }
  if (JSON.stringify(aliasesFor(skill.loads.rows)) !== JSON.stringify(aliasesFor(vi.loads.rows))) {
    report(viPath, Math.max(vi.loads.start + 1, 1), "LOADS logical dependencies differ from SKILL.md");
  }
  if (JSON.stringify(outline(skill.lines)) !== JSON.stringify(outline(vi.lines))) {
    report(viPath, 1, "section count or order differs from SKILL.md");
  }
  const codes = (lines) => [...new Set(
    [...lines.join("\n").matchAll(/^\| `([A-Z][A-Z0-9-]*-[0-9]+)` \|/gm)].map((match) => match[1]),
  )].sort();
  if (JSON.stringify(codes(skill.lines)) !== JSON.stringify(codes(vi.lines))) {
    report(viPath, 1, "situation codes differ from SKILL.md");
  }
  const enPath = join(dirname(file), "en.md");
  const en = parsed.get(enPath);
  if (!en) {
    report(file, 1, "missing English skill publication");
    continue;
  }
  if (JSON.stringify(aliasesFor(skill.loads.rows)) !== JSON.stringify(aliasesFor(en.loads.rows))) {
    report(enPath, Math.max(en.loads.start + 1, 1), "LOADS logical dependencies differ from SKILL.md");
  }
  if (JSON.stringify(outline(skill.lines)) !== JSON.stringify(outline(en.lines))) {
    report(enPath, 1, "section count or order differs from SKILL.md");
  }
}

const selectedFindings = [...selectedLanes].flatMap((lane) => findings[lane]);
if (selectedFindings.length) {
  console.error(selectedFindings.join("\n"));
  console.error(`\n${selectedFindings.length} finding(s)`);
  process.exit(1);
}

const labels = { context: "Runtime context", en: "English publication", vi: "Vietnamese publication" };
for (const lane of selectedLanes) {
  const count = [...parsed.values()].filter((record) => record.lane === lane).length;
  console.log(`${labels[lane]} dependency graph holds for ${count} record(s).`);
}
