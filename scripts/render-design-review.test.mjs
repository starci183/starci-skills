import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {buildManifest, renderReview} from "./render-design-review.mjs";

const digest = "a".repeat(64);
const token = (name, value) => ({name, declarations: [{source: "theme.css", value}]});

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
  return {root, registry, vocabularyPath};
}

test("one renderer manifest adapts both layout regions and block parts", () => {
  const f = fixture();
  try {
    const layoutPath = join(f.root, "layout.json");
    const layout = {
      schema: 1,
      envelope: {session: "sample/2026-08-20", round: 1, project: "sample", surface: "sample-layout"},
      candidates: [{
        id: "rail-layout",
        direction,
        axes: {navigation: "rail", evidence: "below", secondary: "panel", chrome: "sticky"},
        citesPrecedent: "none",
        regions: [{name: "summary", entry: {verdict: "reuse", key: "summary"}, assembler: "Tree", mount: "per-route", whyMatch: "The route needs one stable summary region."}],
        reason: "The rail keeps navigation beside one stable page body."
      }]
    };
    writeFileSync(layoutPath, JSON.stringify(layout));
    writeFileSync(join(f.registry, "design-registry-v2.json"), JSON.stringify({layoutHeads: {}, blockHeads: {}, objects: {byHash: {}}}));

    const layoutManifest = buildManifest({phase: "layout", project: "sample", artifact: layoutPath, registry: f.registry, vocabulary: f.vocabularyPath});
    assert.equal(layoutManifest.candidates[0].status, "proposed");
    assert.equal(layoutManifest.candidates[0].regions[0].blockStatus, "missing");
    assert.equal(layoutManifest.theme.accent.value, "#e94f99");

    const layoutHash = layoutManifest.candidates[0].hash;
    writeFileSync(join(f.registry, "objects", "sha256", `${layoutHash}.json`), JSON.stringify(layout.candidates[0]));
    writeFileSync(join(f.registry, "design-registry-v2.json"), JSON.stringify({
      layoutHeads: {"sample-layout": {head: layoutHash, regions: ["summary"]}},
      blockHeads: {},
      objects: {byHash: {[layoutHash]: {path: `objects/sha256/${layoutHash}.json`}}}
    }));

    const blockPath = join(f.root, "block.json");
    writeFileSync(blockPath, JSON.stringify({
      schema: 1,
      envelope: {session: "sample-block/2026-08-20", round: 1, project: "sample", region: "summary", layoutHash},
      anatomies: [{
        id: "summary-stack",
        axes: {dataOwner: "parent", repetition: "single", weight: "populated", composition: "label-value"},
        citesPrecedent: "none",
        states: ["populated", "pending", "failed"],
        parts: [{name: "summary-label", cites: {kind: "leaf", verdict: "reuse", key: "Typography"}, whyMatch: "The summary needs one stable label before its value."}],
        reason: "A label-value stack keeps the summary readable in every state."
      }]
    }));

    const blockManifest = buildManifest({phase: "block", project: "sample", layoutId: "sample-layout", blockId: "summary", artifact: blockPath, registry: f.registry, vocabulary: f.vocabularyPath});
    assert.equal(blockManifest.identity.parentLayoutHash, layoutHash);
    assert.equal(blockManifest.candidates[0].parts[0].name, "summary-label");
    assert.deepEqual(blockManifest.candidates[0].states, ["populated", "pending", "failed"]);

    const out = join(f.root, ".worktrees", "sample", "cache", "preview", "sample-layout");
    renderReview({phase: "layout", project: "sample", artifact: layoutPath, registry: f.registry, vocabulary: f.vocabularyPath, out, noBuild: true});
    const written = JSON.parse(readFileSync(join(out, "review-manifest.json"), "utf8"));
    assert.equal(written.identity.layoutId, "sample-layout");
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});

test("renderer refuses output outside the project preview cache", () => {
  const f = fixture();
  try {
    const artifact = join(f.root, "layout.json");
    writeFileSync(artifact, JSON.stringify({schema: 1, envelope: {project: "sample", surface: "sample-layout"}, candidates: []}));
    writeFileSync(join(f.registry, "design-registry-v2.json"), JSON.stringify({layoutHeads: {}, blockHeads: {}, objects: {byHash: {}}}));
    assert.throws(() => renderReview({phase: "layout", project: "sample", artifact, registry: f.registry, vocabulary: f.vocabularyPath, out: join(f.root, "unsafe"), noBuild: true}), /must stay under/);
  } finally {
    rmSync(f.root, {recursive: true, force: true});
  }
});
