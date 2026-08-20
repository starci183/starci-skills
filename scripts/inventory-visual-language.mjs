#!/usr/bin/env node

// Inventory CSS custom properties from a verified frontend checkout.
//
//   node scripts/inventory-visual-language.mjs --root <frontend> --out <inventory.json>
//
// The output is evidence for direction brainstorming, not a token compiler. Every declaration is
// retained because light, dark and scoped modes may legitimately define the same property.

import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {dirname, extname, relative, resolve, sep} from "node:path";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};

const rootArg = valueOf("root");
const outArg = valueOf("out");
if (!rootArg || !outArg) {
  console.error("usage: inventory-visual-language.mjs --root <frontend> --out <inventory.json>");
  process.exit(2);
}

const root = resolve(rootArg);
const out = resolve(outArg);
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`frontend root is not a directory: ${root}`);
  process.exit(1);
}

const ignored = new Set([".git", ".next", ".nuxt", ".output", "build", "coverage", "dist", "node_modules", "out"]);
const extensions = new Set([".css", ".pcss", ".scss"]);
const files = [];

function walk(path) {
  for (const entry of readdirSync(path, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(resolve(path, entry.name));
      continue;
    }
    const dot = entry.name.lastIndexOf(".");
    if (dot !== -1 && extensions.has(entry.name.slice(dot).toLowerCase())) files.push(resolve(path, entry.name));
  }
}

walk(root);

const imported = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/g;
const allFiles = new Set(files);
const queue = [...files];

function resolveStylesheet(specifier, importer) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const base = resolve(dirname(importer), specifier);
    for (const candidate of [base, `${base}.css`, resolve(base, "index.css")]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return undefined;
  }
  try {
    return createRequire(importer).resolve(specifier);
  } catch {
    return undefined;
  }
}

for (let at = 0; at < queue.length; at += 1) {
  const importer = queue[at];
  const css = readFileSync(importer, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of css.matchAll(imported)) {
    const dependency = resolveStylesheet(match[1], importer);
    if (!dependency || !extensions.has(extname(dependency).toLowerCase()) || allFiles.has(dependency)) continue;
    allFiles.add(dependency);
    queue.push(dependency);
  }
}

files.length = 0;
files.push(...allFiles);
files.sort();

const declarations = new Map();
for (const file of files) {
  const source = relative(root, file).split(sep).join("/");
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of css.matchAll(/(^|[;{\s])(--[A-Za-z_][A-Za-z0-9_-]*)\s*:\s*([^;{}]+);/gm)) {
    const name = match[2];
    const value = match[3].trim().replace(/\s+/g, " ");
    if (!value) continue;
    const rows = declarations.get(name) ?? [];
    rows.push({source, value});
    declarations.set(name, rows);
  }
}

const sources = files.map((file) => relative(root, file).split(sep).join("/"));
const tokens = [...declarations.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, rows]) => ({
    name,
    declarations: rows,
  }));
const digest = createHash("sha256").update(JSON.stringify({sources, tokens})).digest("hex");
const inventory = {
  schema: 1,
  root,
  digest,
  sources,
  tokens,
};

await mkdir(dirname(out), {recursive: true});
await writeFile(out, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(`wrote ${out} — ${inventory.tokens.length} token(s) from ${inventory.sources.length} stylesheet(s)`);
