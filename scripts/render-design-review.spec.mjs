import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {test} from "node:test";
import {buildManifest, renderReview} from "./render-design-review.mjs";

const digest = "a".repeat(64);
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const direction = {
  id: "quiet-review",
  vocabularyAt: digest,
  roles: {
    ground: {verdict: "reuse", token: "--ground"},
    surface: {verdict: "reuse", token: "--surface"},
    content: {verdict: "reuse", token: "--content"},
    mutedContent: {verdict: "reuse", token: "--muted"},
    accent: {verdict: "reuse", token: "--accent"},
    separator: {verdict: "reuse", token: "--separator"}
  }
};

const conditionInventory = (states) => [
  {family: "viewport", applicability: "applicable", evidence: "Desktop and mobile are product breakpoints.", values: ["desktop", "mobile"], stateIds: states.map((state) => state.id ?? state)},
  ...["overlay", "disclosure", "async", "data", "permission"].map((family) => ({family, applicability: "not-applicable", evidence: `Fixture has no ${family} condition.`, values: [], stateIds: []})),
  {family: "interaction", applicability: "applicable", evidence: "The primary control advances state.", values: ["advance"], stateIds: states.map((state) => state.id ?? state)}
];
const contentMatrix = (states) => states.map((state) => ({stateId: state.id ?? state, entityKinds: ["course"], facts: ["Course title and progress"], actions: ["Continue"], densityReason: "Fixture represents the owned course state."}));
const stateDocument = (states) => `<!doctype html><html data-functional-preview="true"><head><style>body{margin:0}@media(max-width:700px){body{margin:0}}</style><script>document.addEventListener("click",event=>{if(event.target.closest("[data-action]")) document.body.dataset.changed="true"})</script></head><body>${states.map((state) => `<template data-state="${state}"><main data-rendered-state="${state}" data-business-state="${state}"><h1>${state}</h1><button data-action="advance">Continue</button></main></template>`).join("")}</body></html>`;

function writeRevision(registry, identity, artifact, states) {
  const preview = stateDocument(states.map((state) => state.id));
  const previewSha256 = sha256(preview);
  const decision = {
    schemaVersion: 2,
    ...identity,
    functional: true,
    principleObligations: [{target: identity.blockId ?? identity.layoutId, module: "flow", situation: "FLOW-CONTENT-1", reason: "The fixture uses a deliberate reading flow."}],
    contentMatrix: contentMatrix(states),
    conditionInventory: conditionInventory(states),
    transitions: [{id: "advance", from: states[0].id, action: "advance", to: states.at(-1).id}],
    artifact,
    states
  };
  const revisionHash = sha256(`${canonical(decision)}\n${previewSha256}`);
  const root = join(registry, "revisions", revisionHash);
  mkdirSync(root, {recursive: true});
  writeFileSync(join(root, "design.json"), JSON.stringify({...decision, previewSha256}));
  writeFileSync(join(root, "preview.html"), preview);
  return {revisionHash, root};
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "design-review-"));
  const registry = join(root, "registries");
  mkdirSync(registry, {recursive: true});
  const vocabularyPath = join(root, "vocabulary.json");
  writeFileSync(vocabularyPath, JSON.stringify({
    schema: 1,
    root,
    digest,
    tokens: [
      {name: "--ground", declarations: [{value: "#f5f5f6"}]},
      {name: "--surface", declarations: [{value: "#fff"}]},
      {name: "--content", declarations: [{value: "#202124"}]},
      {name: "--muted", declarations: [{value: "#70747a"}]},
      {name: "--accent", declarations: [{value: "#e94f99"}]},
      {name: "--separator", declarations: [{value: "#e4e5e8"}]}
    ]
  }));

  const layout = {
    id: "rail-layout",
    direction,
    axes: {navigation: "rail"},
    regions: [{name: "summary", entry: {verdict: "reuse", key: "summary"}, assembler: "Tree", mount: "per-route", whyMatch: "Stable summary."}],
    reason: "A rail and one exact body."
  };
  const layoutRevision = writeRevision(registry, {kind: "layout", layoutId: "sample-layout"}, layout, [
    {id: "desktop", viewport: {width: 1440, height: 900}},
    {id: "narrow", viewport: {width: 390, height: 844}}
  ]);
  const anatomy = {
    id: "summary-stack",
    axes: {dataOwner: "parent"},
    states: ["populated", "pending", "failed"],
    parts: [{name: "summary-label", cites: {verdict: "reuse"}, whyMatch: "Stable label."}],
    reason: "A summary stack."
  };
  const blockRevision = writeRevision(registry, {kind: "block", layoutId: "sample-layout", blockId: "summary", layoutHash: layoutRevision.revisionHash}, anatomy, [
    {id: "populated", viewport: {width: 720, height: 600}},
    {id: "pending", viewport: {width: 720, height: 600}},
    {id: "failed", viewport: {width: 720, height: 600}}
  ]);
  writeFileSync(join(registry, "design-registry-v2.json"), JSON.stringify({
    schemaVersion: 2,
    project: "sample",
    layoutHeads: {"sample-layout": {layoutId: "sample-layout", head: layoutRevision.revisionHash, regions: ["summary"]}},
    blockHeads: {"sample-layout/summary": {layoutId: "sample-layout", blockId: "summary", layoutHash: layoutRevision.revisionHash, head: blockRevision.revisionHash}},
    revisions: {immutable: true, byHash: {
      [layoutRevision.revisionHash]: {hash: layoutRevision.revisionHash, path: `revisions/${layoutRevision.revisionHash}`},
      [blockRevision.revisionHash]: {hash: blockRevision.revisionHash, path: `revisions/${blockRevision.revisionHash}`}
    }}
  }));
  return {root, registry, vocabularyPath, layout, anatomy, layoutRevision, blockRevision};
}

function writeDraftPreview(root, phase, binding, candidates, states) {
  mkdirSync(root, {recursive: true});
  for (const candidate of candidates) writeFileSync(join(root, `${candidate.id}.html`), stateDocument(states.map((state) => state.id)));
  const path = join(root, "preview-index.json");
  writeFileSync(path, JSON.stringify({
    schema: 2,
    phase,
    ...binding,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      html: `${candidate.id}.html`,
      states,
      functional: true,
      contentMatrix: contentMatrix(states),
      conditionInventory: conditionInventory(states),
      transitions: [{id: "advance", from: states[0].id, action: "advance", to: states.at(-1).id}]
    }))
  }));
  return path;
}

test("all-current loads immutable layout and block preview bundles with exact state viewports", () => {
  const f = fixture();
  try {
    const manifest = buildManifest({allCurrent: true, project: "sample", registry: f.registry, vocabulary: f.vocabularyPath});
    const layout = manifest.layouts[0].candidates[0];
    assert.equal(layout.hash, f.layoutRevision.revisionHash);
    assert.deepEqual(layout.preview.states.map((state) => state.id), ["desktop", "narrow"]);
    assert.equal(layout.preview.states[1].viewport.width, 390);
    assert.doesNotMatch(layout.preview.states[0].html, /<template/);
    const child = layout.regions[0].block;
    assert.equal(child.currentHead, f.blockRevision.revisionHash);
    assert.deepEqual(child.candidates[0].preview.states.map((state) => state.id), f.anatomy.states);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("layout review requires and packages exactly 3-4 authored HTML candidates", () => {
  const f = fixture();
  try {
    const candidates = ["calm", "dense", "editorial"].map((id) => ({...f.layout, id, reason: `${id} composition`}));
    const artifact = join(f.root, "layout.json");
    writeFileSync(artifact, JSON.stringify({schema: 1, envelope: {project: "sample", surface: "sample-layout"}, candidates}));
    const htmlIndex = writeDraftPreview(join(f.root, "layout-preview"), "layout", {layoutId: "sample-layout"}, candidates, [{id: "desktop", viewport: {width: 1440, height: 900}}]);
    const manifest = buildManifest({phase: "layout", project: "sample", layoutId: "sample-layout", artifact, htmlIndex, registry: f.registry, vocabulary: f.vocabularyPath});
    assert.deepEqual(manifest.layouts[0].candidates.map((candidate) => candidate.id), ["calm", "dense", "editorial"]);
    assert.ok(manifest.layouts[0].candidates.every((candidate) => candidate.preview.states.length === 1));
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

const existingNode = {id: "app-shell", kind: "app-layout", change: "existing", source: "src/app/layout.tsx", sourceHash: "b".repeat(64)};

function pageSetCandidate(base, id, pages) {
  return {
    ...base,
    id,
    reason: `${id} composed page set`,
    pages,
    regions: base.regions.map((region) => ({...region, pageId: pages[0].id, change: "proposed"}))
  };
}

test("single composed page requires choices and packages its full viewport state", () => {
  const f = fixture();
  try {
    const page = {id: "lesson", route: "/courses/course/learn/content", state: "lesson-ready", nodes: [existingNode, {id: "lesson-page", parentId: "app-shell", kind: "page", change: "proposed"}], regions: ["summary"]};
    const candidates = ["calm", "focused", "dense"].map((id) => pageSetCandidate(f.layout, id, [page]));
    const artifact = join(f.root, "single-page.json");
    writeFileSync(artifact, JSON.stringify({schema: 4, envelope: {project: "sample", surface: "sample-layout", scope: {kind: "page", source: "screenshot"}}, candidates}));
    const htmlIndex = writeDraftPreview(join(f.root, "single-page-preview"), "layout", {layoutId: "sample-layout"}, candidates, [{id: "lesson-ready", viewport: {width: 1440, height: 900}}]);
    const manifest = buildManifest({phase: "layout", project: "sample", layoutId: "sample-layout", artifact, htmlIndex, registry: f.registry, vocabulary: f.vocabularyPath});
    assert.equal(manifest.layouts[0].scope.kind, "page");
    assert.equal(manifest.layouts[0].candidates.length, 3);
    assert.equal(manifest.layouts[0].candidates[0].pages[0].nodes[0].change, "existing");
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("three-page flow packages 3-4 coherent candidates with every page state", () => {
  const f = fixture();
  try {
    const pages = ["create-order", "review-order", "order-success"].map((id) => ({
      id,
      route: `/orders/${id}`,
      state: `${id}-ready`,
      nodes: [existingNode, {id: `${id}-page`, parentId: "app-shell", kind: "page", change: "new"}],
      regions: [`${id}-content`]
    }));
    const candidates = ["guided", "balanced", "dense"].map((id) => pageSetCandidate({...f.layout, axes: {navigation: id}}, id, pages));
    for (const candidate of candidates) candidate.regions = pages.map((page) => ({...f.layout.regions[0], name: page.regions[0], pageId: page.id, change: "new"}));
    const artifact = join(f.root, "flow.json");
    writeFileSync(artifact, JSON.stringify({schema: 4, envelope: {project: "sample", surface: "sample-layout", scope: {kind: "flow", source: "description"}}, candidates}));
    const states = pages.map((page) => ({id: page.state, viewport: {width: 1440, height: 900}}));
    const htmlIndex = writeDraftPreview(join(f.root, "flow-preview"), "layout", {layoutId: "sample-layout"}, candidates, states);
    const manifest = buildManifest({phase: "layout", project: "sample", layoutId: "sample-layout", artifact, htmlIndex, registry: f.registry, vocabulary: f.vocabularyPath});
    assert.equal(manifest.layouts[0].candidates.length, 3);
    assert.deepEqual(manifest.layouts[0].candidates[0].preview.states.map((state) => state.id), states.map((state) => state.id));
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("long flow refuses fewer than three alternatives and missing composed page HTML", () => {
  const f = fixture();
  try {
    const pages = ["create-order", "review-order", "order-success"].map((id) => ({id, route: `/orders/${id}`, state: `${id}-ready`, nodes: [existingNode], regions: ["summary"]}));
    const candidates = ["one", "two", "three"].map((id) => pageSetCandidate(f.layout, id, pages));
    const artifact = join(f.root, "bad-flow.json");
    writeFileSync(artifact, JSON.stringify({schema: 4, envelope: {project: "sample", surface: "sample-layout", scope: {kind: "flow", source: "description"}}, candidates: [candidates[0]]}));
    const oneIndex = writeDraftPreview(join(f.root, "one-flow-preview"), "layout", {layoutId: "sample-layout"}, [candidates[0]], pages.map((page) => ({id: page.state, viewport: {width: 1440, height: 900}})));
    assert.throws(() => buildManifest({phase: "layout", project: "sample", layoutId: "sample-layout", artifact, htmlIndex: oneIndex, registry: f.registry, vocabulary: f.vocabularyPath}), /contain 3-4 candidate/);

    writeFileSync(artifact, JSON.stringify({schema: 4, envelope: {project: "sample", surface: "sample-layout", scope: {kind: "flow", source: "description"}}, candidates}));
    const incompleteIndex = writeDraftPreview(join(f.root, "missing-page-preview"), "layout", {layoutId: "sample-layout"}, candidates, [{id: "create-order-ready", viewport: {width: 1440, height: 900}}]);
    assert.throws(() => buildManifest({phase: "layout", project: "sample", layoutId: "sample-layout", artifact, htmlIndex: incompleteIndex, registry: f.registry, vocabulary: f.vocabularyPath}), /missing composed pages/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("block review packages three authored candidates and every declared block state", () => {
  const f = fixture();
  try {
    const candidates = ["stack", "cards", "ledger"].map((id) => ({...f.anatomy, id, reason: `${id} composition`}));
    const artifact = join(f.root, "block.json");
    writeFileSync(artifact, JSON.stringify({schema: 1, envelope: {project: "sample", region: "summary", layoutHash: f.layoutRevision.revisionHash}, anatomies: candidates}));
    const states = f.anatomy.states.map((id) => ({id, viewport: {width: 720, height: 600}}));
    const htmlIndex = writeDraftPreview(join(f.root, "block-preview"), "block", {layoutId: "sample-layout", layoutHash: f.layoutRevision.revisionHash, blockId: "summary"}, candidates, states);
    const manifest = buildManifest({phase: "block", project: "sample", layoutId: "sample-layout", blockId: "summary", artifact, htmlIndex, registry: f.registry, vocabulary: f.vocabularyPath});
    const block = manifest.layouts[0].candidates[0].regions[0].block;
    assert.equal(block.candidates.length, 3);
    assert.ok(block.candidates.every((candidate) => candidate.preview.states.length === 3));
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("packaging refuses a review without authored HTML", () => {
  const f = fixture();
  try {
    const candidates = ["one", "two", "three"].map((id) => ({...f.layout, id}));
    const artifact = join(f.root, "layout.json");
    writeFileSync(artifact, JSON.stringify({envelope: {project: "sample", surface: "sample-layout"}, candidates}));
    assert.throws(() => buildManifest({phase: "layout", project: "sample", layoutId: "sample-layout", artifact, registry: f.registry, vocabulary: f.vocabularyPath}), /html-index is required/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("packaging refuses a state declared by design but absent from preview.html", () => {
  const f = fixture();
  try {
    const designPath = join(f.blockRevision.root, "design.json");
    const design = JSON.parse(readFileSync(designPath, "utf8"));
    design.states.push({id: "empty", viewport: {width: 720, height: 600}});
    writeFileSync(designPath, JSON.stringify(design));
    assert.throws(() => buildManifest({allCurrent: true, project: "sample", registry: f.registry, vocabulary: f.vocabularyPath}), /hash is invalid|state mismatch/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("packaging refuses a modified persisted preview", () => {
  const f = fixture();
  try {
    writeFileSync(join(f.layoutRevision.root, "preview.html"), stateDocument(["changed"]));
    assert.throws(() => buildManifest({allCurrent: true, project: "sample", registry: f.registry, vocabulary: f.vocabularyPath}), /preview digest/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("renderer writes one graph below project preview cache and refuses other output", () => {
  const f = fixture();
  try {
    const out = join(f.root, ".worktrees", "sample", "cache", "preview", "design-review");
    renderReview({allCurrent: true, project: "sample", registry: f.registry, vocabulary: f.vocabularyPath, out, noBuild: true});
    assert.equal(JSON.parse(readFileSync(join(out, "review-manifest.json"), "utf8")).layouts[0].layoutId, "sample-layout");
    assert.throws(() => renderReview({allCurrent: true, project: "sample", registry: f.registry, vocabulary: f.vocabularyPath, out: join(f.root, "unsafe"), noBuild: true}), /must stay under/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});
