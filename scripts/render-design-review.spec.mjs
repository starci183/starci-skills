import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {buildManifest, renderReview} from "./render-design-review.mjs";

const digest = "a".repeat(64);
const token = (name, value) => ({name, declarations: [{source: "theme.css", value}]});
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex");

const direction = {
  id: "quiet-review",
  vocabularyAt: digest,
  axes: {contrast: "balanced", density: "compact", shape: "soft", depth: "flat", motion: "still"},
  citesPrecedent: "none",
  personality: ["quiet", "focused", "technical"],
  roles: {
    ground: {verdict: "reuse", token: "--ground"},
    surface: {verdict: "reuse", token: "--surface"},
    content: {verdict: "reuse", token: "--content"},
    mutedContent: {verdict: "reuse", token: "--muted"},
    accent: {verdict: "reuse", token: "--accent"},
    separator: {verdict: "reuse", token: "--separator"},
    display: {verdict: "reuse", token: "--content"},
    body: {verdict: "reuse", token: "--content"},
    label: {verdict: "reuse", token: "--muted"},
    radius: {verdict: "reuse", token: "--radius"},
    elevation: {verdict: "none", why: "The review stays flat and evidence-led."},
    duration: {verdict: "none", why: "The comparison needs no presentational motion."},
    easing: {verdict: "none", why: "No transition means no easing decision is needed."}
  },
  rejects: ["floating decoration"],
  reason: "A quiet review keeps structural evidence legible."
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "design-review-"));
  const registry = join(root, "registries");
  mkdirSync(join(registry, "objects", "sha256"), {recursive: true});
  const vocabularyPath = join(root, "vocabulary.json");
  writeFileSync(vocabularyPath, JSON.stringify({
    schema: 1,
    root,
    digest,
    sources: ["theme.css"],
    tokens: [
      token("--ground", "#f5f5f6"), token("--surface", "#ffffff"), token("--content", "#202124"),
      token("--muted", "#70747a"), token("--accent", "#e94f99"), token("--separator", "#e4e5e8"), token("--radius", "10px")
    ]
  }));

  const layout = {
    id: "rail-layout",
    direction,
    axes: {navigation: "rail", evidence: "below", secondary: "panel", chrome: "sticky"},
    citesPrecedent: "none",
    regions: [{name: "summary", entry: {verdict: "reuse", key: "summary"}, assembler: "Tree", mount: "per-route", whyMatch: "The route needs one stable summary region."}],
    reason: "The rail keeps navigation beside one stable page body."
  };
  const layoutHash = hash(layout);
  const anatomy = {
    id: "summary-stack",
    axes: {dataOwner: "parent", repetition: "single", weight: "populated", composition: "label-value"},
    citesPrecedent: "none",
    states: ["populated", "pending", "failed"],
    parts: [{name: "summary-label", cites: {kind: "leaf", verdict: "reuse", key: "Typography"}, whyMatch: "The summary needs one stable label before its value."}],
    reason: "A label-value stack keeps the summary readable in every state."
  };
  const blockHash = hash(anatomy);
  writeFileSync(join(registry, "objects", "sha256", `${layoutHash}.json`), JSON.stringify(layout));
  writeFileSync(join(registry, "objects", "sha256", `${blockHash}.json`), JSON.stringify(anatomy));
  writeFileSync(join(registry, "design-registry-v2.json"), JSON.stringify({
    layoutHeads: {"sample-layout": {layoutId: "sample-layout", head: layoutHash, regions: ["summary"]}},
    blockHeads: {"sample-layout/summary": {layoutId: "sample-layout", blockId: "summary", layoutHash, head: blockHash}},
    objects: {byHash: {
      [layoutHash]: {path: `objects/sha256/${layoutHash}.json`},
      [blockHash]: {path: `objects/sha256/${blockHash}.json`}
    }}
  }));
  return {root, registry, vocabularyPath, layout, layoutHash, anatomy, blockHash};
}

test("all-current graph binds accepted child blocks to the exact parent layout hash", () => {
  const f = fixture();
  try {
    const manifest = buildManifest({allCurrent: true, project: "sample", registry: f.registry, vocabulary: f.vocabularyPath});
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.layouts[0].candidates[0].hash, f.layoutHash);
    const child = manifest.layouts[0].candidates[0].regions[0].block;
    assert.equal(child.layoutId, "sample-layout");
    assert.equal(child.layoutHash, f.layoutHash);
    assert.equal(child.blockId, "summary");
    assert.equal(child.status, "accepted");
    assert.equal(child.currentHead, f.blockHash);
    assert.equal(child.renderedId, "summary-stack");
    assert.match(manifest.entryRoute, new RegExp(f.layoutHash));
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});

test("block review adds proposed children without replacing the accepted block rendered on layout", () => {
  const f = fixture();
  try {
    const artifactPath = join(f.root, "block.json");
    const proposed = {...f.anatomy, id: "summary-grid", reason: "A proposed grid compares the same summary evidence."};
    writeFileSync(artifactPath, JSON.stringify({
      schema: 1,
      envelope: {round: 1, project: "sample", region: "summary", layoutHash: f.layoutHash},
      anatomies: [proposed]
    }));
    const manifest = buildManifest({phase: "block", project: "sample", layoutId: "sample-layout", blockId: "summary", artifact: artifactPath, registry: f.registry, vocabulary: f.vocabularyPath, recommendedId: "summary-grid"});
    const child = manifest.layouts[0].candidates[0].regions[0].block;
    assert.equal(child.recommendedId, "summary-grid");
    assert.equal(child.renderedId, "summary-stack");
    assert.equal(child.candidates.length, 2);
    assert.match(manifest.entryRoute, /\/blocks\/summary$/);
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});

test("draft index overlays block candidates and block-specific content in one project graph", () => {
  const f = fixture();
  try {
    const drafts = join(f.root, "drafts");
    mkdirSync(drafts);
    const artifact = "summary.json";
    const content = "summary.content.json";
    writeFileSync(join(drafts, artifact), JSON.stringify({
      schema: 1,
      envelope: {round: 1, project: "sample", region: "summary", layoutHash: f.layoutHash},
      anatomies: [{...f.anatomy, id: "summary-review", reason: "A reviewed summary stays bound to the exact parent."}]
    }));
    writeFileSync(join(drafts, content), JSON.stringify({
      eyebrow: "Summary",
      title: "Exact block content",
      description: "Content belongs to this block review only.",
      primaryAction: "Continue",
      rows: [{title: "Score", description: "78 percent"}]
    }));
    writeFileSync(join(drafts, "index.json"), JSON.stringify([{
      layoutId: "sample-layout",
      blockId: "summary",
      artifact,
      content,
      recommendedId: "summary-review"
    }]));
    const manifest = buildManifest({draftIndex: join(drafts, "index.json"), project: "sample", registry: f.registry, vocabulary: f.vocabularyPath});
    const child = manifest.layouts[0].candidates[0].regions[0].block;
    assert.equal(child.recommendedId, "summary-review");
    assert.equal(child.renderedId, "summary-stack");
    assert.equal(child.content.title, "Exact block content");
    assert.match(manifest.entryRoute, /\/blocks\/summary$/);
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});

test("settled draft index keeps only the accepted candidate in the current graph", () => {
  const f = fixture();
  try {
    const drafts = join(f.root, "drafts");
    mkdirSync(drafts);
    writeFileSync(join(drafts, "summary.json"), JSON.stringify({
      schema: 1,
      envelope: {round: 1, project: "sample", region: "summary", layoutHash: f.layoutHash},
      anatomies: [f.anatomy, {...f.anatomy, id: "rejected-summary", reason: "A rejected alternative uses another presentation."}]
    }));
    writeFileSync(join(drafts, "index.json"), JSON.stringify([{
      layoutId: "sample-layout", blockId: "summary", artifact: "summary.json", recommendedId: "rejected-summary"
    }]));
    const manifest = buildManifest({draftIndex: join(drafts, "index.json"), project: "sample", registry: f.registry, vocabulary: f.vocabularyPath});
    const child = manifest.layouts[0].candidates[0].regions[0].block;
    assert.equal(child.recommendedId, "summary-stack");
    assert.equal(child.candidates.length, 1);
    assert.equal(child.candidates[0].hash, f.blockHash);
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});

test("a replacement layout marks old child heads stale and falls back to rough content", () => {
  const f = fixture();
  try {
    const artifactPath = join(f.root, "layout.json");
    const replacement = {...f.layout, id: "new-layout", reason: "A replacement layout changes the parent version."};
    writeFileSync(artifactPath, JSON.stringify({
      schema: 1,
      envelope: {round: 1, project: "sample", surface: "sample-layout"},
      candidates: [replacement]
    }));
    const manifest = buildManifest({phase: "layout", project: "sample", layoutId: "sample-layout", artifact: artifactPath, registry: f.registry, vocabulary: f.vocabularyPath, recommendedId: "new-layout"});
    const child = manifest.layouts[0].candidates[0].regions[0].block;
    assert.equal(child.status, "stale");
    assert.equal(child.renderedId, undefined);
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});

test("the first layout candidate renders before an accepted layout head exists", () => {
  const f = fixture();
  try {
    writeFileSync(join(f.registry, "design-registry-v2.json"), JSON.stringify({
      schemaVersion: 2,
      project: "sample",
      layoutHeads: {},
      blockHeads: {},
      objects: {immutable: true, byHash: {}}
    }));
    const artifactPath = join(f.root, "first-layout.json");
    writeFileSync(artifactPath, JSON.stringify({
      schema: 1,
      envelope: {round: 1, project: "sample", surface: "sample-layout"},
      candidates: [f.layout]
    }));
    const manifest = buildManifest({phase: "layout", project: "sample", layoutId: "sample-layout", artifact: artifactPath, registry: f.registry, vocabulary: f.vocabularyPath, recommendedId: f.layout.id});
    assert.equal(manifest.layouts.length, 1);
    assert.equal(manifest.layouts[0].layoutId, "sample-layout");
    assert.equal(manifest.layouts[0].candidates[0].status, "proposed");
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});

test("layout draft index overlays multiple first layouts into one project graph", () => {
  const f = fixture();
  try {
    writeFileSync(join(f.registry, "design-registry-v2.json"), JSON.stringify({
      schemaVersion: 2,
      project: "sample",
      layoutHeads: {},
      blockHeads: {},
      objects: {immutable: true, byHash: {}}
    }));
    const drafts = join(f.root, "layout-drafts");
    mkdirSync(drafts);
    const layouts = [
      {layoutId: "authentication", id: "centred-door"},
      {layoutId: "dashboard", id: "sticky-spine"}
    ];
    for (const item of layouts) {
      writeFileSync(join(drafts, `${item.layoutId}.json`), JSON.stringify({
        schema: 1,
        envelope: {round: 1, project: "sample", surface: item.layoutId},
        candidates: [{...f.layout, id: item.id}]
      }));
      writeFileSync(join(drafts, `${item.layoutId}.content.json`), JSON.stringify({
        eyebrow: item.layoutId,
        title: `${item.layoutId} content`,
        description: "Representative content for this layout only.",
        rows: [{title: "Evidence", description: "One stable row."}]
      }));
    }
    writeFileSync(join(drafts, "index.json"), JSON.stringify({
      schema: 1,
      layouts: layouts.map((item) => ({
        layoutId: item.layoutId,
        artifact: `${item.layoutId}.json`,
        content: `${item.layoutId}.content.json`,
        recommendedId: item.id
      })),
      flows: [{
        id: "entry-to-console",
        label: "Entry to console",
        nodes: [
          {id: "sign-in", label: "Sign in", layoutId: "authentication"},
          {id: "open-dashboard", label: "Open dashboard", layoutId: "dashboard", blockId: "summary"}
        ]
      }]
    }));
    const manifest = buildManifest({
      layoutDraftIndex: join(drafts, "index.json"),
      project: "sample",
      registry: f.registry,
      vocabulary: f.vocabularyPath
    });
    assert.deepEqual(manifest.layouts.map((layout) => layout.layoutId), ["authentication", "dashboard"]);
    assert.equal(manifest.layouts[0].content.title, "authentication content");
    assert.equal(manifest.layouts[1].content.title, "dashboard content");
    assert.match(manifest.entryRoute, /\/layouts\/authentication\//);
    assert.equal(manifest.flows[0].nodes[0].order, 1);
    assert.match(manifest.flows[0].nodes[1].route, /\/layouts\/dashboard\/.+\/blocks\/summary$/);
    assert.deepEqual(manifest.flows[0].edges, [{from: "sign-in", to: "open-dashboard"}]);
    assert.equal(manifest.evidence.at(-1).label, "layoutDraftIndex");
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});

test("renderer writes one project graph and refuses output outside preview cache", () => {
  const f = fixture();
  try {
    const out = join(f.root, ".worktrees", "sample", "cache", "preview", "design-review");
    renderReview({allCurrent: true, project: "sample", registry: f.registry, vocabulary: f.vocabularyPath, out, noBuild: true});
    const written = JSON.parse(readFileSync(join(out, "review-manifest.json"), "utf8"));
    assert.equal(written.layouts[0].layoutId, "sample-layout");
    assert.throws(() => renderReview({allCurrent: true, project: "sample", registry: f.registry, vocabulary: f.vocabularyPath, out: join(f.root, "unsafe"), noBuild: true}), /must stay under/);
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});
