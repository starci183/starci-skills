#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(trustRoot, "context-manifest.json");

const omittedSections = new Set([
  "anchor",
  "worked example",
  "scope",
]);

const optionalExampleLabels = new Set([
  "common business situations",
  "common situations",
]);
const ignoredRuntimeDirectories = new Set([".git", ".claude", ".testtmp", "docs", "node_modules", "worktrees", "sessions", "cache"]);

function normalize(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n";
}

export function sourceHash(text) {
  return createHash("sha256").update(normalize(text)).digest("hex");
}

function recordKey(path) {
  return relative(trustRoot, path).split(sep).join("/");
}

function readManifest() {
  if (!existsSync(manifestPath)) return {version: 1, records: {}};
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  return {version: 1, records: parsed.records ?? {}};
}

function writeManifest(manifest) {
  const records = Object.fromEntries(Object.entries(manifest.records).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(manifestPath, `${JSON.stringify({version: 1, records}, null, 2)}\n`, "utf8");
}

export function contextManifestEntry(sourcePath) {
  return {
    kind: "module",
    source: recordKey(sourcePath),
    sourceHash: sourceHash(readFileSync(sourcePath, "utf8")),
    contextVersion: 1,
  };
}

function splitFrontmatter(text) {
  const normalized = normalize(text);
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { frontmatter: "", body: normalized };
  return { frontmatter: match[1], body: normalized.slice(match[0].length) };
}

function topLevelSections(body) {
  const lines = body.split("\n");
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^##\s+(.+)$/);
    if (match) starts.push({ index, heading: match[1] });
  }
  const prefixEnd = starts[0]?.index ?? lines.length;
  const sections = starts.map((start, index) => ({
    heading: start.heading,
    lines: lines.slice(start.index, starts[index + 1]?.index ?? lines.length),
  }));
  return { prefix: lines.slice(0, prefixEnd), sections };
}

function headingKey(heading) {
  return heading.replace(/^`|`$/g, "").trim().toLowerCase();
}

function stripOptionalExampleBlocks(lines, family) {
  const kept = [];
  let dropping = false;
  for (const line of lines) {
    const label = line.match(/^\*\*([^*]+)\.\*\*/)?.[1]?.trim().toLowerCase();
    if (label) dropping = optionalExampleLabels.has(label);
    if (!dropping) kept.push(line);
  }
  while (kept.length > 1 && kept.at(-1).trim() === "") kept.pop();
  return kept;
}

function familyFor(sourcePath) {
  const path = sourcePath.split(sep).join("/");
  if (path.includes("/compilers/principles/")) return "principle";
  if (path.includes("/compilers/patterns/")) return "pattern";
  if (path.includes("/gates/")) return "gate";
  if (path.includes("/skills/skill-shape/")) return "skill-shape";
  return "operation";
}

function keepSection(section, family) {
  const key = headingKey(section.heading);
  if (omittedSections.has(key)) return false;

  // Compiler and gate code entries are themselves routing records. Keep them in full except for
  // explicitly labelled illustrative lists; their Recognition/Boundary/Detection prose is law.
  if (["principle", "pattern", "gate"].includes(family)) return true;

  // Operational modules have heterogeneous procedure headings. Defaulting to retention is safer:
  // only universally non-runtime sections are mechanically omitted.
  return true;
}

function canonicalLoads(section) {
  if (!section) return "## LOADS\n\nNone.";
  const text = section.lines.join("\n").trimEnd();
  if (/^\| Alias \| Target \| Kind \| Why \|$/m.test(text)) {
    return text
      .replace(
        /^\| `(@[a-z][a-z0-9-]*)` \| `([^`]+)` \| module \| ([^|]+) \|$/gm,
        (_, alias, target, why) => `| \`${alias}\` | \`${target.replace(/\/$/, "")}/context.md\` | context | ${why.trim()} |`,
      )
      .replace(
        /^\| `(@[a-z][a-z0-9-]*)` \| `([^`]+)\/en\.md` \| en \| ([^|]+) \|$/gm,
        (_, alias, target, why) => `| \`${alias}\` | \`${target}/context.md\` | context | ${why.trim()} |`,
      );
  }

  const legacyRows = [...text.matchAll(/^\| `(@[a-z][a-z0-9-]*)` \| `([^`]+)` \| ([^|]+) \|$/gm)];
  if (!legacyRows.length) return "## LOADS\n\nNone.";
  return [
    "## LOADS",
    "",
    "| Alias | Target | Kind | Why |",
    "|---|---|---|---|",
    ...legacyRows.map(([, alias, target, why]) =>
      `| \`${alias}\` | \`${target.replace(/\/$/, "")}/context.md\` | context | ${why.trim()} |`,
    ),
  ].join("\n");
}

export function compileContext(sourceText, sourcePath = "en.md") {
  const normalized = normalize(sourceText);
  const { body } = splitFrontmatter(normalized);
  const family = familyFor(resolve(sourcePath));
  const { prefix, sections } = topLevelSections(body);
  const loads = sections.find((section) => headingKey(section.heading) === "loads");
  const retained = sections
    .filter((section) => headingKey(section.heading) !== "loads")
    .filter((section) => keepSection(section, family))
    .map((section) => stripOptionalExampleBlocks(section.lines, family).join("\n").trimEnd())
    .filter(Boolean);
  const titleIndex = prefix.findIndex((line) => /^# (?!#)/.test(line));
  const beforeLoads = titleIndex >= 0 ? prefix.slice(0, titleIndex + 1) : prefix;
  const afterLoads = titleIndex >= 0 ? prefix.slice(titleIndex + 1) : [];
  const compiledBody = [beforeLoads.join("\n").trim(), canonicalLoads(loads), afterLoads.join("\n").trim(), ...retained]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");

  return normalize(compiledBody);
}

function discoverSources(target) {
  const absolute = resolve(target);
  if (!existsSync(absolute)) throw new Error(`target does not exist: ${target}`);
  if (statSync(absolute).isFile()) {
    if (basename(absolute) !== "en.md") throw new Error(`source file must be named en.md: ${target}`);
    if (existsSync(join(dirname(absolute), "SKILL.md"))) return [];
    return [absolute];
  }
  const sources = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignoredRuntimeDirectories.has(entry.name)) continue;
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) sources.push(...discoverSources(path));
    else if (entry.isFile() && entry.name === "en.md" && !existsSync(join(absolute, "SKILL.md"))) sources.push(path);
  }
  return sources;
}

function discoverContexts(target) {
  const absolute = resolve(target);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return basename(absolute) === "context.md" ? [absolute] : [];
  const contexts = [];
  for (const entry of readdirSync(absolute, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignoredRuntimeDirectories.has(entry.name)) continue;
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) contexts.push(...discoverContexts(path));
    else if (entry.isFile() && entry.name === "context.md") contexts.push(path);
  }
  return contexts;
}

function headings(body) {
  return [...body.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
}

function sectionText(body, heading) {
  const sections = topLevelSections(body).sections;
  return sections.find((section) => section.heading === heading)?.lines.join("\n").trim() ?? null;
}

function loadAliases(section) {
  if (section === null) return [];
  return [...section.matchAll(/^\| `(@[a-z][a-z0-9-]*)` \|/gm)].map((match) => match[1]);
}

export function checkContextFile(sourcePath, declaredEntry) {
  const contextPath = join(dirname(sourcePath), "context.md");
  if (!existsSync(contextPath)) return { ok: false, contextPath, reason: "missing context.md" };
  const sourceText = normalize(readFileSync(sourcePath, "utf8"));
  const actual = normalize(readFileSync(contextPath, "utf8"));
  const entry = declaredEntry ?? readManifest().records[recordKey(contextPath)];
  const body = actual;
  const failures = [];
  if (actual.startsWith("---\n")) failures.push("context.md must not carry frontmatter");
  if (!entry) failures.push("missing context manifest entry");
  else {
    if (entry.kind !== "module") failures.push("context manifest kind must be module");
    if (entry.contextVersion !== 1) failures.push("context manifest version must be 1");
    if (entry.source !== recordKey(sourcePath)) failures.push("context manifest source does not match en.md");
    if (!/^[a-f0-9]{64}$/.test(entry.sourceHash ?? "")) failures.push("manifest sourceHash must be 64 lowercase hex characters");
    else if (entry.sourceHash !== sourceHash(sourceText)) failures.push("manifest sourceHash does not match en.md");
  }

  const sourceBody = splitFrontmatter(sourceText).body;
  const sourceHeadings = headings(sourceBody);
  const contextHeadings = headings(body);
  const contextSet = new Set(contextHeadings);
  const critical = /^(?:LOADS|Record|Law|Rules|Exceptions|Output|Stops|Proof|Situation codes|Routing|Published rules|Categories)$/i;
  const codeHeading = /^`?[A-Z][A-Z0-9-]*-\d+`?(?:\s|$)/;
  for (const heading of sourceHeadings) {
    if ((critical.test(heading) || codeHeading.test(heading)) && !contextSet.has(heading)) {
      failures.push(`missing binding section: ${heading}`);
    }
  }
  const sourceLoads = sectionText(sourceBody, "LOADS");
  const contextLoads = sectionText(body, "LOADS");
  if (contextLoads === null) failures.push("missing binding section: LOADS");
  else {
    const contextAliases = new Set(loadAliases(contextLoads));
    for (const alias of loadAliases(sourceLoads)) {
      if (!contextAliases.has(alias)) failures.push(`LOADS is missing source alias: ${alias}`);
    }
  }

  for (const heading of contextHeadings) {
    if (omittedSections.has(headingKey(heading))) failures.push(`forbidden teaching section: ${heading}`);
  }
  if (/^\*\*Common (?:business )?situations\.\*\*/m.test(body)) {
    failures.push("forbidden teaching block: Common business situations");
  }
  return failures.length
    ? { ok: false, contextPath, reason: failures.join("; ") }
    : { ok: true, contextPath };
}

export function refreshContextMetadata(sourcePath, manifest = readManifest()) {
  const contextPath = join(dirname(sourcePath), "context.md");
  if (!existsSync(contextPath)) return { ok: false, contextPath, reason: "missing context.md" };
  manifest.records[recordKey(contextPath)] = contextManifestEntry(sourcePath);
  return {ok: true, contextPath, manifest};
}

function usage() {
  console.error("Usage: node scripts/compile-context.mjs (--write|--refresh|--check) <en.md-or-directory> [...]");
}

function main(argv) {
  const [mode, ...targets] = argv;
  if (!["--write", "--refresh", "--check"].includes(mode) || targets.length === 0) {
    usage();
    return 2;
  }
  const sources = [...new Set(targets.flatMap(discoverSources))].sort();
  const contexts = [...new Set(targets.flatMap(discoverContexts))].sort();
  const manifest = readManifest();
  const failures = [];
  for (const sourcePath of sources) {
    const contextPath = join(dirname(sourcePath), "context.md");
    if (mode === "--write") {
      writeFileSync(contextPath, compileContext(readFileSync(sourcePath, "utf8"), sourcePath), "utf8");
      manifest.records[recordKey(contextPath)] = contextManifestEntry(sourcePath);
      console.log(`wrote ${relative(trustRoot, contextPath).split(sep).join("/")}`);
      continue;
    }
    if (mode === "--refresh") {
      const result = refreshContextMetadata(sourcePath, manifest);
      if (!result.ok) failures.push(`${relative(trustRoot, result.contextPath).split(sep).join("/")}: ${result.reason}`);
      else console.log(`refreshed ${relative(trustRoot, result.contextPath).split(sep).join("/")}`);
      continue;
    }
    const result = checkContextFile(sourcePath, manifest.records[recordKey(contextPath)]);
    if (!result.ok) failures.push(`${relative(trustRoot, result.contextPath).split(sep).join("/")}: ${result.reason}`);
  }

  const pairedContexts = new Set(sources.map((sourcePath) => join(dirname(sourcePath), "context.md")));
  const routers = contexts.filter((contextPath) => !pairedContexts.has(contextPath));
  for (const contextPath of routers) {
    const key = recordKey(contextPath);
    if (mode === "--write" || mode === "--refresh") {
      manifest.records[key] = {kind: "router", contextVersion: 1};
      continue;
    }
    const actual = normalize(readFileSync(contextPath, "utf8"));
    const entry = manifest.records[key];
    if (actual.startsWith("---\n")) failures.push(`${key}: router context must not carry frontmatter`);
    if (entry?.kind !== "router" || entry?.contextVersion !== 1) failures.push(`${key}: missing router manifest entry`);
  }
  if (mode === "--write" || mode === "--refresh") writeManifest(manifest);
  if (failures.length) {
    console.error(failures.join("\n"));
    return 1;
  }
  console.log(`Context contract holds for ${sources.length} module(s) and ${routers.length} router(s).`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
