import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {buildManifest, renderReview} from "./render-design-review.mjs";

const states = [{id: "ready", viewport: {width: 1440, height: 900}}, {id: "narrow", viewport: {width: 390, height: 844}}];
const html = (id) => `<!doctype html><html data-functional-preview="true"><head><script>document.addEventListener("click",()=>{})</script></head><body><template data-state="ready"><main><h1>${id}</h1><button>Continue</button></main></template><template data-state="narrow"><main><h1>${id} narrow</h1><button>Continue</button></main></template></body></html>`;

function fixture(phase = "layout") {
  const root = mkdtempSync(join(tmpdir(), "session-review-"));
  const candidates = ["calm", "focused", "dense"].map((id) => ({id, axes: {density: id}, reason: `${id} candidate`}));
  const artifact = join(root, "artifact.json");
  writeFileSync(artifact, JSON.stringify(phase === "block"
    ? {envelope: {project: "sample", region: "summary"}, anatomies: candidates}
    : {envelope: {project: "sample", surface: "course-page", scope: {kind: "page", source: "description"}}, candidates}));
  const previewRoot = join(root, "previews");
  mkdirSync(previewRoot, {recursive: true});
  for (const candidate of candidates) writeFileSync(join(previewRoot, `${candidate.id}.html`), html(candidate.id));
  const htmlIndex = join(previewRoot, "preview-index.json");
  writeFileSync(htmlIndex, JSON.stringify({phase, layoutId: "course-page", ...(phase === "block" ? {blockId: "summary"} : {}), recommendedId: "focused", candidates: candidates.map((candidate) => ({id: candidate.id, html: `${candidate.id}.html`, states, functional: true}))}));
  return {root, artifact, htmlIndex};
}

test("layout review packages only current session candidates", () => {
  const f = fixture();
  try {
    const manifest = buildManifest({project: "sample", artifact: f.artifact, htmlIndex: f.htmlIndex, sessionId: "abc"});
    assert.equal(manifest.schemaVersion, 3);
    assert.equal(manifest.sessionId, "abc");
    assert.equal(manifest.layouts[0].recommendedId, "focused");
    assert.equal(manifest.layouts[0].candidates.length, 3);
    assert.doesNotMatch(manifest.layouts[0].candidates[0].preview.states[0].html, /<template/);
    assert.equal(manifest.evidence.at(-1).value, "ignored-session-cache");
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("block review binds current source parent without registry state", () => {
  const f = fixture("block");
  try {
    const manifest = buildManifest({project: "sample", phase: "block", layoutId: "course-page", blockId: "summary", artifact: f.artifact, htmlIndex: f.htmlIndex});
    assert.equal(manifest.phase, "block");
    assert.equal(manifest.layouts[0].candidates[0].regions[0].name, "summary");
    assert.ok(manifest.layouts[0].candidates.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.hash)));
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("renderer writes below project design cache and refuses other output", () => {
  const f = fixture();
  try {
    const out = join(f.root, ".worktrees", "sample", "cache", "design", "abc", "review");
    renderReview({project: "sample", artifact: f.artifact, htmlIndex: f.htmlIndex, out, noBuild: true});
    assert.equal(JSON.parse(readFileSync(join(out, "review-manifest.json"), "utf8")).schemaVersion, 3);
    assert.throws(() => renderReview({project: "sample", artifact: f.artifact, htmlIndex: f.htmlIndex, out: join(f.root, "unsafe"), noBuild: true}), /must stay under/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});

test("review refuses incomplete candidate sets", () => {
  const f = fixture();
  try {
    writeFileSync(f.artifact, JSON.stringify({envelope: {project: "sample", surface: "course-page"}, candidates: [{id: "only"}]}));
    assert.throws(() => buildManifest({project: "sample", artifact: f.artifact, htmlIndex: f.htmlIndex}), /3-4 candidates/);
  } finally { rmSync(f.root, {recursive: true, force: true}); }
});
