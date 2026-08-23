import assert from "node:assert/strict";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {buildManifest, renderReview} from "./render-design-review.mjs";

const states = [{id: "ready", viewport: {width: 1440, height: 900}}, {id: "narrow", viewport: {width: 390, height: 844}}];
const html = (id) => `<!doctype html><html data-functional-preview="true"><head><script>document.addEventListener("click",()=>{})</script></head><body><template data-state="ready"><main><h1>${id}</h1><button>Continue</button></main></template><template data-state="narrow"><main><h1>${id} narrow</h1><button>Continue</button></main></template></body></html>`;

function fixture(phase = "layout", mode = phase === "layout" ? "generate" : "audit") {
  const root = mkdtempSync(join(tmpdir(), "session-review-"));
  const ids = mode === "brainstorm" ? ["calm", "focused", "dense"] : [phase === "layout" ? "complete-flow" : "current-block"];
  const candidates = ids.map((id) => ({id, axes: {density: id}, reason: `${id} candidate`}));
  const artifact = join(root, "artifact.json");
  writeFileSync(artifact, JSON.stringify(phase === "block"
    ? {envelope: {project: "sample", region: "summary", mode}, anatomies: candidates}
    : {envelope: {project: "sample", surface: "course-page", mode, scope: {kind: "page", source: "description"}}, candidates}));
  const previewRoot = join(root, "previews");
  mkdirSync(previewRoot, {recursive: true});
  for (const candidate of candidates) writeFileSync(join(previewRoot, `${candidate.id}.html`), html(candidate.id));
  const htmlIndex = join(previewRoot, "preview-index.json");
  writeFileSync(htmlIndex, JSON.stringify({phase, mode, layoutId: "course-page", ...(phase === "block" ? {blockId: "summary"} : {}), recommendedId: candidates[0].id, candidates: candidates.map((candidate) => ({id: candidate.id, html: `${candidate.id}.html`, states, functional: true}))}));
  const designSystem = join(root, "design-system.json");
  writeFileSync(designSystem, JSON.stringify({systemId: "starci-master"}));
  const baseline = join(root, "baseline.json");
  writeFileSync(baseline, JSON.stringify({
    schemaVersion: 1, project: "sample", scope: {kind: "page", routes: ["/course"]},
    references: [{id: "ready", kind: "legacy", route: "/course", state: "ready", viewport: {width: 1440, height: 900}}],
    owner: {id: "course-page", directChildren: ["heading", "content"], annotation: {x: 0, y: 0, width: 1440, height: 900}, childBounds: {heading: {x: 20, y: 20, width: 1000, height: 100}, content: {x: 20, y: 140, width: 1000, height: 700}}},
    invariant: {kind: "page", statement: "The current page preserves its heading and content owners."},
    proof: [{referenceId: "ready", fullViewport: true, targetRegion: true}], preserve: ["heading"], allowedDeltas: ["content"]
  }));
  return {root, artifact, htmlIndex, designSystem, baseline};
}

const options = (f) => ({project: "sample", artifact: f.artifact, htmlIndex: f.htmlIndex, designSystem: f.designSystem, baseline: f.baseline});

test("layout generate packages one complete long-page/full-flow result", () => {
  const f = fixture();
  try {
    const manifest = buildManifest({...options(f), sessionId: "abc"});
    assert.equal(manifest.schemaVersion, 4);
    assert.equal(manifest.sessionId, "abc");
    assert.equal(manifest.mode, "generate");
    assert.equal(manifest.reviewStage, "full");
    assert.equal(manifest.layouts[0].candidates.length, 1);
    assert.doesNotMatch(manifest.layouts[0].candidates[0].preview.states[0].html, /<template/);
    assert.equal(manifest.systemId, "starci-master");
    assert.equal(manifest.evidence.at(-1).value, "ignored-session-cache");
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("block audit binds one Layout-generated block inside current parent", () => {
  const f = fixture("block");
  try {
    const manifest = buildManifest({...options(f), phase: "block", layoutId: "course-page", blockId: "summary"});
    assert.equal(manifest.phase, "block");
    assert.equal(manifest.mode, "audit");
    assert.equal(manifest.layouts[0].candidates[0].regions[0].name, "summary");
    assert.ok(manifest.layouts[0].candidates.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.hash)));
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("renderer writes static HTML directly below project cache and refuses other output", () => {
  const f = fixture();
  try {
    const out = join(f.root, ".sessions", "sample", "abc", "design", "review");
    const rendered = renderReview({...options(f), out});
    assert.equal(JSON.parse(readFileSync(join(out, "review-manifest.json"), "utf8")).schemaVersion, 4);
    assert.match(readFileSync(join(out, "index.html"), "utf8"), /<iframe class="frame"/);
    assert.equal(rendered.entries.length, 2);
    assert.equal(existsSync(join(out, rendered.entries[0].path)), true);
    assert.throws(() => renderReview({...options(f), out: join(f.root, "unsafe")}), /must stay under/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("layout page review is labeled as cache-only pages stage", () => {
  const f = fixture();
  try {
    const artifact = JSON.parse(readFileSync(f.artifact, "utf8"));
    artifact.envelope.stage = "pages";
    writeFileSync(f.artifact, JSON.stringify(artifact));
    const manifest = buildManifest(options(f));
    assert.equal(manifest.reviewStage, "pages");
    assert.equal(manifest.mode, "generate");
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("explicit brainstorm requires 3-4 alternatives", () => {
  const f = fixture("layout", "brainstorm");
  try {
    assert.equal(buildManifest(options(f)).layouts[0].candidates.length, 3);
    writeFileSync(f.artifact, JSON.stringify({envelope: {project: "sample", surface: "course-page"}, candidates: [{id: "only"}]}));
    assert.throws(() => buildManifest({...options(f), mode: "brainstorm"}), /3-4 candidates/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});
