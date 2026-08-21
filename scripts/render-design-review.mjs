#!/usr/bin/env node

import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {dirname, join, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {validateDesignBaseline} from "./validate-design-baseline.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = resolve(dirname(scriptPath), "../publication/design-review-preview/app");
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const load = (path, label) => {
  if (!path || !existsSync(path)) throw new Error(`${label} is missing: ${path ?? "<unset>"}`);
  return JSON.parse(readFileSync(path, "utf8"));
};

const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function stateDocument(source, stateId) {
  const escaped = stateId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`<template\\s+data-state=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/template>`, "i"));
  if (!match) return source;
  const head = source.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  return `<!doctype html><html data-functional-preview="true"><head>${head}</head><body>${match[1]}</body></html>`;
}

function previewFor(indexRoot, entry) {
  if (!entry.html || !Array.isArray(entry.states) || !entry.states.length) throw new Error(`candidate ${entry.id} requires html and states`);
  const source = readFileSync(resolve(indexRoot, entry.html), "utf8");
  if (entry.functional !== true || !/data-functional-preview=["']true["']/.test(source)) throw new Error(`candidate ${entry.id} must be functional authored HTML`);
  return {
    html: source,
    states: entry.states.map((state) => {
      if (!slug.test(state.id ?? "") || !Number.isInteger(state.viewport?.width) || !Number.isInteger(state.viewport?.height)) {
        throw new Error(`candidate ${entry.id} has an invalid state viewport`);
      }
      return {id: state.id, viewport: state.viewport, html: stateDocument(source, state.id)};
    })
  };
}

function regionsFor(candidate, phase, blockId) {
  if (Array.isArray(candidate.regions) && candidate.regions.length) return candidate.regions.map((region) => ({
    ...region,
    entry: region.entry ?? {verdict: "reuse"},
    assembler: region.assembler ?? "current-source",
    mount: region.mount ?? "in-place",
    whyMatch: region.whyMatch ?? "The session candidate preserves the current source owner."
  }));
  return [{
    name: blockId ?? "page-content",
    entry: {verdict: "reuse"},
    assembler: phase === "block" ? "current-block-owner" : "current-page-owner",
    mount: "in-place",
    whyMatch: "The review is bound to the current routed source composition."
  }];
}

export function buildManifest(options) {
  for (const required of ["project", "artifact", "htmlIndex", "designSystem", "baseline"]) if (!options[required]) throw new Error(`--${required} is required`);
  const artifactPath = resolve(options.artifact);
  const indexPath = resolve(options.htmlIndex);
  const artifact = load(artifactPath, "design artifact");
  const previewIndex = load(indexPath, "HTML preview index");
  const designSystemPath = resolve(options.designSystem);
  const baselinePath = resolve(options.baseline);
  const designSystem = load(designSystemPath, "MASTER design system");
  const baseline = load(baselinePath, "composition baseline");
  const baselineVerdict = validateDesignBaseline(baseline);
  if (!baselineVerdict.ok) throw new Error(`invalid composition baseline: ${baselineVerdict.failures.join("; ")}`);
  if (designSystem.systemId !== "starci-master") throw new Error("review requires the StarCi MASTER design system");
  if (baseline.project !== options.project) throw new Error("baseline project differs from review project");
  const candidates = artifact.candidates ?? artifact.anatomies;
  if (!Array.isArray(candidates) || candidates.length < 3 || candidates.length > 4) throw new Error("design artifact must contain 3-4 candidates");
  if (!Array.isArray(previewIndex.candidates) || previewIndex.candidates.length !== candidates.length) throw new Error("preview index must cover every candidate");

  const phase = options.phase ?? previewIndex.phase ?? (artifact.anatomies ? "block" : "layout");
  if (!["layout", "block"].includes(phase)) throw new Error("--phase must be layout or block");
  const layoutId = options.layoutId ?? previewIndex.layoutId ?? artifact.envelope?.surface ?? artifact.envelope?.region;
  if (!slug.test(layoutId ?? "")) throw new Error("a slug layoutId is required");
  const blockId = options.blockId ?? previewIndex.blockId ?? artifact.envelope?.region;
  if (phase === "block" && !slug.test(blockId ?? "")) throw new Error("block review requires a slug blockId");

  const indexRoot = dirname(indexPath);
  const previewById = new Map(previewIndex.candidates.map((entry) => [entry.id, entry]));
  const packaged = candidates.map((candidate) => {
    if (!slug.test(candidate.id ?? "")) throw new Error("every candidate requires a slug id");
    const previewEntry = previewById.get(candidate.id);
    if (!previewEntry) throw new Error(`candidate ${candidate.id} has no authored HTML`);
    return {
      ...candidate,
      hash: sha256(canonical({phase, candidate})),
      status: "proposed",
      reason: candidate.reason ?? `Session candidate ${candidate.id}`,
      axes: candidate.axes ?? {},
      regions: regionsFor(candidate, phase, blockId),
      preview: previewFor(indexRoot, previewEntry)
    };
  });
  const recommendedId = options.recommendedId ?? previewIndex.recommendedId ?? packaged[0].id;
  if (!packaged.some((candidate) => candidate.id === recommendedId)) throw new Error("recommendedId is not a candidate");
  const recommended = packaged.find((candidate) => candidate.id === recommendedId);

  return {
    schemaVersion: 3,
    project: options.project,
    sessionId: options.sessionId ?? "current-session",
    systemId: designSystem.systemId,
    baselineAt: sha256(canonical(baseline)),
    phase,
    entryRoute: `#/reviews/${layoutId}/${recommended.hash}`,
    layouts: [{
      layoutId,
      recommendedId,
      scope: artifact.envelope?.scope,
      theme: {},
      candidates: packaged
    }],
    evidence: [
      {label: "sessionArtifact", value: artifactPath},
      {label: "htmlPreviewIndex", value: indexPath},
      {label: "masterDesignSystem", value: designSystemPath},
      {label: "compositionBaseline", value: baselinePath},
      {label: "durability", value: "ignored-session-cache"}
    ]
  };
}

function assertOutputPath(outDir, project) {
  const marker = `${sep}.worktrees${sep}${project}${sep}cache${sep}design${sep}`;
  if (!`${resolve(outDir)}${sep}`.includes(marker)) throw new Error(`review output must stay under .worktrees/${project}/cache/design`);
}

function runNpm(args) {
  const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  execFileSync(command, commandArgs, {cwd: appRoot, stdio: "inherit"});
}

function ensureRuntime() {
  if (!existsSync(join(appRoot, "node_modules", "vite", "package.json"))) runNpm(["ci", "--ignore-scripts"]);
}

function runtimeFingerprint() {
  const files = ["index.html", "package-lock.json", "package.json", "tsconfig.json", "vite.config.ts"];
  for (const name of readdirSync(join(appRoot, "src"))) if (statSync(join(appRoot, "src", name)).isFile()) files.push(join("src", name));
  return sha256(files.sort().map((file) => `${file}\n${readFileSync(join(appRoot, file), "utf8")}`).join("\n"));
}

function buildRuntime(outDir) {
  ensureRuntime();
  const fingerprint = runtimeFingerprint();
  const marker = join(outDir, ".viewer-build.sha256");
  if (existsSync(join(outDir, "index.html")) && existsSync(marker) && readFileSync(marker, "utf8").trim() === fingerprint) return;
  runNpm(["run", "build", "--", "--outDir", outDir, "--emptyOutDir", "false"]);
  writeFileSync(marker, `${fingerprint}\n`, "utf8");
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--no-build") result.noBuild = true;
    else if (value.startsWith("--")) {
      const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      result[key] = argv[index + 1];
      index += 1;
    }
  }
  return result;
}

export function renderReview(options) {
  if (!options.out) throw new Error("--out is required");
  const outDir = resolve(options.out);
  assertOutputPath(outDir, options.project);
  const manifest = buildManifest(options);
  mkdirSync(outDir, {recursive: true});
  if (!options.noBuild) buildRuntime(outDir);
  writeFileSync(join(outDir, "review-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {outDir, manifest};
}

function main() {
  try {
    const result = renderReview(parseArgs(process.argv.slice(2)));
    console.log(`session review ${result.manifest.project} -> ${join(result.outDir, "index.html")}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === resolve(scriptPath)) main();
