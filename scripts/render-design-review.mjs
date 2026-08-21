#!/usr/bin/env node

import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {validateDesignBaseline} from "./validate-design-baseline.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const load = (path, label) => {
  if (!path || !existsSync(path)) throw new Error(`${label} is missing: ${path ?? "<unset>"}`);
  return JSON.parse(readFileSync(path, "utf8"));
};
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

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
  return {html: source, states: entry.states.map((state) => {
    if (!slug.test(state.id ?? "") || !Number.isInteger(state.viewport?.width) || !Number.isInteger(state.viewport?.height)) throw new Error(`candidate ${entry.id} has an invalid state viewport`);
    return {id: state.id, viewport: state.viewport, html: stateDocument(source, state.id)};
  })};
}

function regionsFor(candidate, phase, blockId) {
  if (Array.isArray(candidate.regions) && candidate.regions.length) return candidate.regions.map((region) => ({...region, entry: region.entry ?? {verdict: "reuse"}, assembler: region.assembler ?? "current-source", mount: region.mount ?? "in-place", whyMatch: region.whyMatch ?? "The session result preserves the current source owner."}));
  return [{name: blockId ?? "page-content", entry: {verdict: "reuse"}, assembler: phase === "block" ? "current-block-owner" : "current-page-owner", mount: "in-place", whyMatch: "The review is bound to the current routed source composition."}];
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
  const phase = options.phase ?? previewIndex.phase ?? (artifact.anatomies ? "block" : "layout");
  if (!["layout", "block"].includes(phase)) throw new Error("--phase must be layout or block");
  const mode = options.mode ?? previewIndex.mode ?? artifact.envelope?.mode ?? (phase === "layout" ? "generate" : "audit");
  const allowedModes = phase === "layout" ? ["generate", "brainstorm"] : ["audit", "brainstorm"];
  if (!allowedModes.includes(mode)) throw new Error(`${phase} review does not support mode ${mode}`);
  if (!Array.isArray(candidates)) throw new Error("design artifact has no candidates");
  if (mode === "brainstorm" && (candidates.length < 3 || candidates.length > 4)) throw new Error("brainstorm mode requires 3-4 candidates");
  if (mode !== "brainstorm" && candidates.length !== 1) throw new Error(`${mode} mode requires exactly one complete result`);
  if (!Array.isArray(previewIndex.candidates) || previewIndex.candidates.length !== candidates.length) throw new Error("preview index must cover every candidate");
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
    return {...candidate, hash: sha256(canonical({phase, candidate})), status: "proposed", reason: candidate.reason ?? `Session result ${candidate.id}`, axes: candidate.axes ?? {}, regions: regionsFor(candidate, phase, blockId), preview: previewFor(indexRoot, previewEntry)};
  });
  const recommendedId = options.recommendedId ?? previewIndex.recommendedId ?? packaged[0].id;
  if (!packaged.some((candidate) => candidate.id === recommendedId)) throw new Error("recommendedId is not a candidate");
  const recommended = packaged.find((candidate) => candidate.id === recommendedId);
  return {
    schemaVersion: 3, project: options.project, sessionId: options.sessionId ?? "current-session", systemId: designSystem.systemId,
    baselineAt: sha256(canonical(baseline)), phase, mode, entryRoute: `previews/${recommended.id}--${recommended.preview.states[0].id}.html`,
    layouts: [{layoutId, recommendedId, scope: artifact.envelope?.scope, theme: {}, candidates: packaged}],
    evidence: [{label: "sessionArtifact", value: artifactPath}, {label: "htmlPreviewIndex", value: indexPath}, {label: "masterDesignSystem", value: designSystemPath}, {label: "compositionBaseline", value: baselinePath}, {label: "durability", value: "ignored-session-cache"}]
  };
}

function assertOutputPath(outDir, project) {
  const marker = `${sep}.worktrees${sep}${project}${sep}cache${sep}design${sep}`;
  if (!`${resolve(outDir)}${sep}`.includes(marker)) throw new Error(`review output must stay under .worktrees/${project}/cache/design`);
}

function reviewIndex(manifest, entries) {
  const buttons = entries.map((entry, index) => `<button type="button" data-src="${escapeHtml(entry.path)}" data-width="${entry.viewport.width}" data-height="${entry.viewport.height}"${index === 0 ? ' class="active"' : ""}>${escapeHtml(entry.candidate)} · ${escapeHtml(entry.state)} · ${entry.viewport.width}×${entry.viewport.height}</button>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manifest.project)} ${escapeHtml(manifest.phase)}:${escapeHtml(manifest.mode)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f5f6;color:#202124;font:14px system-ui,sans-serif}.bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;overflow:auto;padding:10px 12px;border-bottom:1px solid #ddd;background:#fff}.bar strong{white-space:nowrap}.bar button{white-space:nowrap;border:1px solid #ddd;border-radius:8px;background:#fff;padding:7px 10px}.bar button.active{border-color:#e94f99;background:#fff0f7}.stage{display:flex;justify-content:center;padding:16px}.frame{max-width:100%;border:0;background:#fff;box-shadow:0 2px 12px #0001}</style></head><body><nav class="bar"><strong>${escapeHtml(manifest.project)} · ${escapeHtml(manifest.phase)}:${escapeHtml(manifest.mode)}</strong>${buttons}</nav><main class="stage"><iframe class="frame" src="${escapeHtml(entries[0].path)}" width="${entries[0].viewport.width}" height="${entries[0].viewport.height}" title="Product preview"></iframe></main><script>const frame=document.querySelector('.frame');document.querySelectorAll('button[data-src]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('button').forEach(x=>x.classList.remove('active'));button.classList.add('active');frame.src=button.dataset.src;frame.width=button.dataset.width;frame.height=button.dataset.height;}));</script></body></html>`;
}

const parseArgs = (argv) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) if (argv[index].startsWith("--")) { const key = argv[index].slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); result[key] = argv[index + 1]; index += 1; }
  return result;
};

export function renderReview(options) {
  if (!options.out) throw new Error("--out is required");
  const outDir = resolve(options.out);
  assertOutputPath(outDir, options.project);
  const manifest = buildManifest(options);
  const previewRoot = join(outDir, "previews");
  mkdirSync(previewRoot, {recursive: true});
  const entries = [];
  for (const candidate of manifest.layouts[0].candidates) for (const state of candidate.preview.states) {
    const name = `${candidate.id}--${state.id}.html`;
    writeFileSync(join(previewRoot, name), state.html, "utf8");
    entries.push({candidate: candidate.id, state: state.id, viewport: state.viewport, path: `previews/${name}`});
  }
  writeFileSync(join(outDir, "index.html"), reviewIndex(manifest, entries), "utf8");
  writeFileSync(join(outDir, "review-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {outDir, manifest, entries};
}

function main() {
  try { const result = renderReview(parseArgs(process.argv.slice(2))); console.log(`static review ${result.manifest.project} -> ${join(result.outDir, "index.html")}`); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

if (resolve(process.argv[1] ?? "") === resolve(scriptPath)) main();
