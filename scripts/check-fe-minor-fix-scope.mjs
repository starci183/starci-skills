#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
};

const rootArg = value("--root");
const targetArg = value("--target");
const baseArg = value("--base");

function fail(reason) {
  console.error(`MINOR-FIX-REJECTED: ${reason}`);
  process.exitCode = 1;
}

function git(root, gitArgs) {
  return execFileSync("git", gitArgs, { cwd: root, encoding: "utf8" }).trim();
}

export function normalizeTarget(target) {
  return target.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
}

export function isAllowedTarget(target) {
  return /^(?:src\/components|packages\/ui\/src|src)\/(?:blocks|composites|leaves)\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/){0,2}[A-Z][A-Za-z0-9]*$/.test(target);
}

export function classifyFiles(files) {
  const production = [];
  const tests = [];
  const invalid = [];
  for (const file of files) {
    const name = basename(file);
    if (["index.tsx", "component.tsx"].includes(name)) production.push(file);
    else if (["index.test.tsx", "component.test.tsx", "index.test.ts", "component.test.ts"].includes(name)) tests.push(file);
    else invalid.push(file);
  }
  return { production, tests, invalid };
}

if (!rootArg || !targetArg || args.some((arg, index) => arg.startsWith("--") && !["--root", "--target", "--base"].includes(arg))) {
  console.error("usage: check-fe-minor-fix-scope.mjs --root <frontend> --target <component-folder> [--base <commit>]");
  process.exit(2);
}

const root = resolve(rootArg);
const target = normalizeTarget(targetArg);
if (!existsSync(root)) fail(`frontend root does not exist: ${root}`);
if (!isAllowedTarget(target)) fail(`target is not one existing block, composite, or leaf folder: ${target}`);
if (process.exitCode) process.exit();

const gitRoot = resolve(git(root, ["rev-parse", "--show-toplevel"]));
if (gitRoot !== root) fail(`--root is not the checkout root: ${root}`);
if (process.exitCode) process.exit();

const base = baseArg ?? git(root, ["rev-parse", "HEAD"]);
try {
  git(root, ["cat-file", "-e", `${base}^{commit}`]);
} catch {
  fail(`baseline is not a commit: ${base}`);
}
if (process.exitCode) process.exit();

const trackedAtBase = git(root, ["ls-tree", "-r", "--name-only", base, "--", target]);
if (!trackedAtBase) fail(`target folder did not exist at baseline: ${target}`);
if (process.exitCode) process.exit();

if (!baseArg) {
  const dirty = git(root, ["status", "--porcelain", "--untracked-files=all", "--", target]);
  if (dirty) fail(`target must be clean before write: ${target}`);
  if (!process.exitCode) console.log(JSON.stringify({ state: "eligible", base, target, productionLimit: 2, testLimit: 2, productionChurnLimit: 40 }));
  process.exit();
}

const currentHead = git(root, ["rev-parse", "HEAD"]);
if (currentHead !== base) fail(`HEAD changed during the minor-fix run: ${base} -> ${currentHead}`);
if (process.exitCode) process.exit();

const trackedChanged = git(root, ["diff", "--name-only", base, "--", target]).split(/\r?\n/).filter(Boolean);
const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "--", target]).split(/\r?\n/).filter(Boolean);
const files = [...new Set([...trackedChanged, ...untracked])].sort();
if (files.length === 0) fail(`no patch exists under target: ${target}`);

const outsideFolder = files.filter((file) => normalizeTarget(dirname(file)) !== target);
if (outsideFolder.length > 0) fail(`nested or outside-folder paths are not minor: ${outsideFolder.join(", ")}`);

const { production, tests, invalid } = classifyFiles(files);
if (invalid.length > 0) fail(`unsupported files changed: ${invalid.join(", ")}`);
if (production.length > 2) fail(`production file limit exceeded: ${production.length} > 2`);
if (tests.length > 2) fail(`test file limit exceeded: ${tests.length} > 2`);
if (files.length > 4) fail(`total file limit exceeded: ${files.length} > 4`);
if (untracked.some((file) => production.includes(file))) fail("a minor fix cannot add a new production file");

let productionChurn = 0;
const numstat = git(root, ["diff", "--numstat", base, "--", target]);
for (const line of numstat.split(/\r?\n/).filter(Boolean)) {
  const [added, deleted, file] = line.split("\t");
  if (!production.includes(file)) continue;
  if (added === "-" || deleted === "-") fail(`binary production change is not minor: ${file}`);
  productionChurn += Number(added) + Number(deleted);
}
if (productionChurn > 40) fail(`production churn limit exceeded: ${productionChurn} > 40`);

if (!process.exitCode) console.log(JSON.stringify({ state: "eligible", base, target, files, productionFiles: production.length, testFiles: tests.length, productionChurn }));
