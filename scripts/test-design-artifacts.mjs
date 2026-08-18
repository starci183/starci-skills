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
  "--background", "--card", "--foreground", "--muted-foreground", "--primary", "--border", "--font-sans", "--radius",
];
const vocabulary = write("vocabulary.json", {
  schema: 1,
  root: temp,
  sources: ["app.css"],
  tokens: tokenNames.map((name) => ({name, declarations: [{source: "app.css", value: "initial"}]})),
});

const decision = (token) => ({verdict: "reuse", token});
const direction = (id, axes) => ({
  id,
  vocabularyAt: "abc123",
  axes,
  citesPrecedent: id === "quiet-precision" ? "none" : "catalogue/2026-08-18",
  personality: ["calm", "precise", "restrained"],
  roles: {
    ground: decision("--background"),
    surface: decision("--card"),
    content: decision("--foreground"),
    mutedContent: decision("--muted-foreground"),
    accent: decision("--primary"),
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
const editorial = direction("editorial-clarity", {contrast: "strong", density: "spacious", shape: "square", depth: "flat", motion: "still"});
const directionBatch = write("directions.json", {
  schema: 1,
  envelope: {session: "course-catalogue/2026-08-18", round: 1, project: "example-app", surface: "course-catalogue", prompt: "compare courses quickly", vocabularyAt: "abc123"},
  directions: [quiet, editorial],
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
const layoutEnvelope = {session: "course-catalogue/2026-08-18", round: 1, project: "example-app", surface: "course-catalogue", prompt: "compare courses quickly", contractAt: "abc123"};
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

const blocks = write("blocks.json", {
  schema: 1,
  envelope: {session: "course-catalogue/2026-08-18", round: 2, project: "example-app", region: "results", layoutHash: hash},
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

try {
  const frontend = join(temp, "frontend");
  mkdirSync(frontend);
  writeFileSync(join(frontend, "app.css"), ":root { --background: white; --foreground: black; }\n.dark { --background: black; }\n", "utf8");
  const generatedInventory = join(temp, "generated-vocabulary.json");
  execFileSync(process.execPath, [inventoryScript, "--root", frontend, "--out", generatedInventory], {encoding: "utf8"});
  const generated = JSON.parse(readFileSync(generatedInventory, "utf8"));
  if (generated.tokens.length !== 2 || generated.tokens.find((token) => token.name === "--background")?.declarations.length !== 2) {
    throw new Error("visual inventory did not retain both mode declarations");
  }
  run("--schema", join(root, "brainstorms", "directions", "schema.json"), "--data", directionBatch, "--vocabulary", vocabulary);
  if (!mustFail("--schema", join(root, "brainstorms", "directions", "schema.json"), "--data", directionBatch, "--vocabulary", vocabulary, "--hash").includes("selection has no approval hash")) {
    throw new Error("direction --hash failed for the wrong reason");
  }
  run("--schema", join(root, "brainstorms", "layouts", "schema.json"), "--data", layouts, "--vocabulary", vocabulary, "--hash");
  if (!mustFail("--schema", join(root, "brainstorms", "layouts", "schema.json"), "--data", splitLayouts, "--vocabulary", vocabulary, "--hash").includes("must share the one direction")) {
    throw new Error("split layout directions failed for the wrong reason");
  }
  run("--schema", join(root, "brainstorms", "blocks", "schema.json"), "--data", blocks, "--hash");
  console.log("ok  direction selection, one layout hash, and independent block hash hold");
} finally {
  rmSync(temp, {recursive: true, force: true});
}
