#!/usr/bin/env node

import {execFileSync} from "node:child_process";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validator = join(root, "scripts", "validate-artifact.mjs");
const inventoryScript = join(root, "scripts", "inventory-visual-language.mjs");
const temp = mkdtempSync(join(tmpdir(), "starci-direction-"));
const hash = "a".repeat(64);
const vocabularyAt = "b".repeat(64);

const write = (name, value) => {
  const path = join(temp, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
};

const run = (...args) => execFileSync(process.execPath, [validator, ...args], {encoding: "utf8"});
const mustFail = (...args) => {
  try {
    run(...args);
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  throw new Error(`expected failure: ${args.join(" ")}`);
};

const tokenNames = [
  "--background", "--card", "--foreground", "--muted-foreground", "--primary", "--secondary", "--border", "--font-sans", "--radius",
];
const vocabulary = write("vocabulary.json", {
  schema: 1,
  root: temp,
  digest: vocabularyAt,
  sources: ["app.css"],
  tokens: tokenNames.map((name) => ({name, declarations: [{source: "app.css", value: "initial"}]})),
});

const decision = (token) => ({verdict: "reuse", token});
const direction = (id, axes, accent = "--primary") => ({
  id,
  vocabularyAt,
  axes,
  citesPrecedent: id === "quiet-precision" ? "none" : "catalogue/2026-08-18",
  personality: ["calm", "precise", "restrained"],
  roles: {
    ground: decision("--background"),
    surface: decision("--card"),
    content: decision("--foreground"),
    mutedContent: decision("--muted-foreground"),
    accent: decision(accent),
    separator: decision("--border"),
    display: decision("--font-sans"),
    body: decision("--font-sans"),
    label: decision("--font-sans"),
    radius: decision("--radius"),
    elevation: {verdict: "none", why: "flat surfaces carry no elevation"},
    duration: {verdict: "none", why: "this direction deliberately stays still"},
    easing: {verdict: "none", why: "this direction deliberately stays still"},
  },
  rejects: ["decorative gradients", "floating surfaces"],
  reason: "quiet hierarchy keeps comparison faster than decoration",
});

const quiet = direction("quiet-precision", {contrast: "balanced", density: "compact", shape: "soft", depth: "flat", motion: "still"});
const editorial = direction("editorial-clarity", {contrast: "strong", density: "spacious", shape: "square", depth: "flat", motion: "still"}, "--secondary");
const fakeEditorial = direction("fake-editorial", {contrast: "strong", density: "spacious", shape: "square", depth: "flat", motion: "still"});
const directionBatch = write("directions.json", {
  schema: 2,
  envelope: {round: 1, project: "example-app", surface: "course-catalogue", prompt: "compare courses quickly", vocabularyAt},
  directions: [quiet, editorial],
  recommended: {id: quiet.id, reason: "quiet hierarchy best matches the stated comparison task"},
});
const missingRecommendation = write("missing-recommendation.json", {
  schema: 2,
  envelope: {round: 1, project: "example-app", surface: "course-catalogue", prompt: "compare courses quickly", vocabularyAt},
  directions: [quiet, editorial],
});
const unknownRecommendation = write("unknown-recommendation.json", {
  schema: 2,
  envelope: {round: 1, project: "example-app", surface: "course-catalogue", prompt: "compare courses quickly", vocabularyAt},
  directions: [quiet, editorial],
  recommended: {id: "missing-direction", reason: "this deliberately points at no candidate in the batch"},
});
const fakeDirections = write("fake-directions.json", {
  schema: 1,
  envelope: {round: 1, project: "example-app", surface: "course-catalogue", prompt: "compare courses quickly", vocabularyAt},
  directions: [quiet, fakeEditorial],
});

const region = {
  name: "results",
  entry: {verdict: "reuse", key: "course-catalogue-card"},
  assembler: "SurfaceListCard",
  mount: "per-route",
  whyMatch: "a course is read as one offer with its own entry action",
};
const layout = (id, axes, selected = quiet) => ({
  id,
  direction: selected,
  axes,
  citesPrecedent: id === "a" ? "none" : "catalogue/2026-08-18",
  regions: [region],
  reason: "this skeleton gives the owner a materially different reading order",
});
const layoutEnvelope = {round: 1, project: "example-app", surface: "course-catalogue", prompt: "compare courses quickly", contractAt: "abc123"};
const layouts = write("layouts.json", {
  schema: 1,
  envelope: layoutEnvelope,
  candidates: [
    layout("a", {navigation: "navbar", evidence: "beside", secondary: "panel", chrome: "sticky"}),
    layout("b", {navigation: "rail", evidence: "below", secondary: "route", chrome: "scrolls"}),
  ],
});
const splitLayouts = write("split-layouts.json", {
  schema: 1,
  envelope: layoutEnvelope,
  candidates: [
    layout("a", {navigation: "navbar", evidence: "beside", secondary: "panel", chrome: "sticky"}),
    layout("b", {navigation: "rail", evidence: "below", secondary: "route", chrome: "scrolls"}, editorial),
  ],
});
const geometryLayouts = write("geometry-layouts.json", {
  schema: 2,
  envelope: layoutEnvelope,
  candidates: [layout("a", {navigation: "navbar", evidence: "beside", secondary: "panel", chrome: "sticky"})],
});
const boundedLayouts = write("bounded-layouts.json", {
  schema: 2,
  envelope: layoutEnvelope,
  candidates: [{
    ...layout("a", {navigation: "navbar", evidence: "beside", secondary: "panel", chrome: "sticky"}),
    regions: [{...region, geometry: {placement: "main", width: "wide", height: "fill", align: "stretch"}}],
  }],
});
const unbriefedLayouts = write("unbriefed-layouts.json", {
  schema: 3,
  envelope: layoutEnvelope,
  candidates: [{
    ...layout("a", {navigation: "navbar", evidence: "beside", secondary: "panel", chrome: "sticky"}),
    regions: [{...region, geometry: {placement: "main", width: "wide", height: "fill", align: "stretch"}}],
  }],
});
const briefedLayouts = write("briefed-layouts.json", {
  schema: 3,
  envelope: layoutEnvelope,
  candidates: [{
    ...layout("a", {navigation: "navbar", evidence: "beside", secondary: "panel", chrome: "sticky"}),
    regions: [{...region, geometry: {placement: "main", width: "wide", height: "fill", align: "stretch"}, brief: {
      kind: "content",
      title: "Course catalogue",
      summary: "Representative offers make the proposed density and reading order judgeable.",
      items: [{role: "text", label: "System Design Mastery", value: "Open course"}],
      primaryAction: "Browse course",
    }}],
  }],
});

const blocks = write("blocks.json", {
  schema: 1,
  envelope: {round: 2, project: "example-app", region: "results", layoutHash: hash},
  anatomies: [{
    id: "a",
    axes: {dataOwner: "parent", repetition: "repeats", weight: "populated", composition: "label-value"},
    citesPrecedent: "none",
    states: ["populated", "empty", "pending"],
    restingCount: 4,
    parts: [{name: "result-row", cites: {kind: "entry", verdict: "reuse", key: "course-catalogue-card"}, whyMatch: "one course offer is compared against its peers"}],
    reason: "rows preserve comparison while every settled state keeps one owner",
  }],
});
const worktreeRoots = write("worktree-roots.json", {
  schema: 1,
  project: "example-app",
  source: root,
  roots: {
    registries: {
      path: ".worktrees/example-app/registries",
      durability: "durable",
      ignored: false,
      ownership: {locked: true, clean: true, branch: "registry/example-app", owningGit: root},
    },
    businesses: {
      path: ".worktrees/example-app/businesses",
      durability: "durable",
      ignored: false,
      ownership: {locked: true, clean: true, branch: "codex/businesses/example-app", owningGit: root},
    },
    cache: {path: ".worktrees/example-app/cache", durability: "rebuildable", ignored: true},
  },
});

try {
  const frontend = join(temp, "frontend");
  mkdirSync(frontend);
  const vendor = join(frontend, "node_modules", "vendor-theme");
  mkdirSync(vendor, {recursive: true});
  writeFileSync(join(vendor, "package.json"), JSON.stringify({name: "vendor-theme", type: "module", exports: {"./css": "./index.css"}}), "utf8");
  writeFileSync(join(vendor, "index.css"), "@import \"./theme.css\";\n", "utf8");
  writeFileSync(join(vendor, "theme.css"), ":root { --vendor-surface: white; --vendor-accent: plum; }\n", "utf8");
  writeFileSync(join(frontend, "app.css"), "@import \"vendor-theme/css\";\n:root { --background: white; --foreground: black; --BrandAccent: red; }\n.dark { --background: black; }\n", "utf8");
  const generatedInventory = join(temp, "generated-vocabulary.json");
  execFileSync(process.execPath, [inventoryScript, "--root", frontend, "--out", generatedInventory], {encoding: "utf8"});
  const generated = JSON.parse(readFileSync(generatedInventory, "utf8"));
  if (!/^[0-9a-f]{64}$/.test(generated.digest) || generated.tokens.length !== 5 || !generated.tokens.some((token) => token.name === "--BrandAccent") || generated.tokens.find((token) => token.name === "--background")?.declarations.length !== 2 || !generated.tokens.some((token) => token.name === "--vendor-accent") || !generated.sources.some((source) => source.endsWith("node_modules/vendor-theme/theme.css"))) {
    throw new Error("visual inventory did not preserve modes or follow declared vendor stylesheet imports");
  }
  run("--schema", join(root, "brainstorms", "directions", "schema.json"), "--data", directionBatch, "--vocabulary", vocabulary);
  if (!mustFail("--schema", join(root, "brainstorms", "directions", "schema.json"), "--data", missingRecommendation, "--vocabulary", vocabulary).includes("must name one evidence-backed default")) {
    throw new Error("missing direction recommendation failed for the wrong reason");
  }
  if (!mustFail("--schema", join(root, "brainstorms", "directions", "schema.json"), "--data", unknownRecommendation, "--vocabulary", vocabulary).includes("does not name a direction in this batch")) {
    throw new Error("unknown direction recommendation failed for the wrong reason");
  }
  if (!mustFail("--schema", join(root, "brainstorms", "directions", "schema.json"), "--data", fakeDirections, "--vocabulary", vocabulary).includes("same render-affecting token decisions")) {
    throw new Error("fake direction choices failed for the wrong reason");
  }
  if (!mustFail("--schema", join(root, "brainstorms", "directions", "schema.json"), "--data", directionBatch, "--vocabulary", vocabulary, "--hash").includes("recommendation has no approval hash")) {
    throw new Error("direction --hash failed for the wrong reason");
  }
  run("--schema", join(root, "brainstorms", "layouts", "schema.json"), "--data", layouts, "--vocabulary", vocabulary, "--hash");
  if (!mustFail("--schema", join(root, "brainstorms", "layouts", "schema.json"), "--data", geometryLayouts, "--vocabulary", vocabulary, "--hash").includes("geometry")) {
    throw new Error("schema 2 layout without child geometry failed for the wrong reason");
  }
  run("--schema", join(root, "brainstorms", "layouts", "schema.json"), "--data", boundedLayouts, "--vocabulary", vocabulary, "--hash");
  if (!mustFail("--schema", join(root, "brainstorms", "layouts", "schema.json"), "--data", unbriefedLayouts, "--vocabulary", vocabulary, "--hash").includes("representative child brief")) {
    throw new Error("schema 3 layout without child brief failed for the wrong reason");
  }
  run("--schema", join(root, "brainstorms", "layouts", "schema.json"), "--data", briefedLayouts, "--vocabulary", vocabulary, "--hash");
  if (!mustFail("--schema", join(root, "brainstorms", "layouts", "schema.json"), "--data", splitLayouts, "--vocabulary", vocabulary, "--hash").includes("must share the one evidence-backed direction")) {
    throw new Error("split layout directions failed for the wrong reason");
  }
  run("--schema", join(root, "brainstorms", "blocks", "schema.json"), "--data", blocks, "--hash");
  run("--schema", join(root, "contexts", "worktrees", "schema.json"), "--data", worktreeRoots);
  console.log("ok  evidence recommendation, one combined layout approval hash, independent block hash, and dependency edge hold");
} finally {
  rmSync(temp, {recursive: true, force: true});
}
