// A finished draw loop installs Work files the product commits: the draw-render record <part>.json and the ui-proof
// score <part>.score.json used to be copied verbatim from the loop round, so they cited the op's STARCI_JOB_SCRATCH
// (<temp>/starci-job-scratch/<64-hex>/draw-loop/...) and the deleted render harness (file:///<temp>/starci-draw-loop-*).
// The product's pre-commit secrets guard (a product repo's scripts/secrets-guard.mjs, step 4 "long hex blob") read the
// scratch dir's 64-hex name as a secret and refused the commit. finishLoop now rewrites every scratch path it installs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../../engine/digest.mjs';
import { blankImage, encodePng } from '../../scripts/work/png.mjs';
import { DEFAULT_RUBRIC } from '../../scripts/work/draw-critic.mjs';
import { fakeCriticOrca, passingVerdict } from '../helpers/fake-critic-orca.mjs';
import { finishLoop, fixturesByWidth, runRound } from '../../scripts/work/draw-loop.mjs';
import { withRationale } from '../helpers/draw-rationale-fixture.mjs';

const tmp = (t, prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); return path.join(root, rel); };

// The refusing check, as the product guard spells it: a 64+ hex run is a secret blob unless its syntax types it as a
// SHA-256 digest (sha256:<hex>, or the value of a key named sha256 / digest / *Sha256).
const HEX_BLOB = /(?<![0-9a-fA-F])[0-9a-fA-F]{64,}(?![0-9a-fA-F])/g;
const typedSha256 = (line, hex) => hex.length === 64 && (line.includes(`sha256:${hex}`)
  || new RegExp(`(?:^|[^A-Za-z0-9_-])(?:[A-Za-z][A-Za-z0-9_-]*Sha256|sha256|digest|planDigest)["']?\\s*:\\s*["']?${hex}`, 'i').test(line));
const guardHits = (text) => text.split(/\r?\n/).flatMap((line) => [...line.matchAll(HEX_BLOB)].map((m) => m[0]).filter((hex) => !typedSha256(line, hex)));

const DRAW = `import { Text } from "@starci/grammar/core"
export const SignInBase = () => <Text>\u0110\u0103ng nh\u1eadp</Text>
`;

test('a finished draw loop installs JSON that cites no scratch path and passes the product secrets guard', async (t) => {
  // The op's scratch, named as the runtime names it (op-prompt.mjs jobScratchDirOf: <temp>/starci-job-scratch/<sha256>).
  const scratch = path.join(tmp(t, 'starci-scratch-paths-'), 'starci-job-scratch', sha256('repo\0wf\0job'));
  const out = path.join(scratch, 'draw-loop', 'signin');

  const repo = tmp(t, 'starci-scratch-repo-');
  const dir = path.join(repo, '.starciwork', 'features', 'login', 'ui', 'authentication', 'assets', 'directions');
  const source = write(dir, 'SignInBase.draw.tsx', DRAW);
  const fixture = write(dir, 'SignInBase.fixture.json', JSON.stringify({ state: 'sign-in-ready', props: { title: 'Nivo' } }));
  const DOM = '<!doctype html><html><body><div id="root"><section data-draw-layout=""><span data-component="Badge" data-grammar-component="Badge" data-tone="success">S\u1eb5n s\u00e0ng</span></section></div></body></html>';
  const why = withRationale(DOM);
  const whyFile = write(dir, 'SignInBase.rationale.json', JSON.stringify(why.entries));
  const grammar = { ok: true, pick: { source: 'product', version: '0.5.0', root: path.join(repo, 'node_modules') }, grammarSource: 'product@0.5.0', attempts: [{ source: 'product', ok: true, errors: [] }] };

  let harness = null;
  // The real render (defaultComponentRender): the harness is a temp dir removed after the capture, the record cites the
  // round's files by absolute path and the harness art by file URL.
  const render = async ({ out: roundDir, viewports, name }) => {
    harness = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-loop-'));
    const art = write(harness, 'assets/nivo-lockup-UPY5CAR6.png', 'png');
    const harnessDir = path.join(roundDir, 'harness');
    fs.mkdirSync(harnessDir, { recursive: true });
    fs.writeFileSync(path.join(harnessDir, 'index.html'), why.html);
    const records = viewports.map((v) => {
      const file = path.join(roundDir, `${name}--${v.width}x${v.height}--light.png`);
      fs.writeFileSync(file, encodePng(blankImage(v.width, v.height)));
      const dom = file.replace(/\.png$/, '.dom.html');
      fs.writeFileSync(dom, why.html);
      const redline = file.replace(/\.png$/, '.redline.png');
      fs.writeFileSync(redline, encodePng(blankImage(v.width, v.height)));
      const rec = { schema: 'starci/draw-render@1', ok: true, failures: [],
        source: { mode: 'component', component: { path: source, sha256: sha256(fs.readFileSync(source)) }, export: 'SignInBase', props: { path: fixture, sha256: sha256(fs.readFileSync(fixture)) }, product: repo },
        viewport: { ...v, deviceScaleFactor: 1 }, image: { path: file, sha256: sha256(fs.readFileSync(file)) },
        layout: { accentExempt: [], artwork: [{ src: pathToFileURL(art).href }] }, ownership: { components: ['Badge'], layoutElements: 1, unownedCount: 0, unowned: [] }, dom: { path: dom },
        rationale: why.measure(v), redline: { path: redline, sha256: sha256(fs.readFileSync(redline)), rationale: whyFile } };
      fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(rec));
      return rec;
    });
    fs.rmSync(harness, { recursive: true, force: true });
    return records;
  };
  const probes = { geometry: async () => ({ findings: [] }), score: async (html, viewport) => ({ schema: 'starci/ui-proof-score@1', ok: true, file: html, viewport, summary: { pass: 5, fail: 0, unmeasurable: 0 }, cases: [], spacing: [] }) };
  const critic = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 9) });
  const r = await runRound({ source, fixtures: fixturesByWidth([fixture]), product: repo, base: 'SignInBase', state: 'sign-in-ready', viewports: [{ width: 1440, height: 900 }, { width: 390, height: 844 }],
    repo, out, render, probes, criticOrca: critic, sourceCheck: async () => ({ findings: [], grammar }) });
  assert.equal(r.stop?.reason, 'passed', JSON.stringify(r.round.codes));
  // The round itself is scratch and may cite scratch: that is the defect's precondition.
  const roundRecord = fs.readFileSync(path.join(out, 'round-1', 'SignInBase#sign-in-ready--390x844--light.json'), 'utf8');
  assert.ok(roundRecord.includes(JSON.stringify(scratch).slice(1, -1)), 'the round record cites the job scratch');

  const done = finishLoop({ out, parts: dir, repo });
  assert.equal(done.outcome, 'passed');

  const json = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const want of ['SignInBase#sign-in-ready--390x844--light.json', 'SignInBase#sign-in-ready--390x844--light.score.json', 'SignInBase#sign-in-ready--390x844--light.rationale.json', 'SignInBase#sign-in-ready--390x844--light.fixture.json']) assert.ok(json.includes(want), want);
  const forms = (p) => [p, p.replace(/\\/g, '/'), p.replace(/\\/g, '\\\\'), pathToFileURL(p).href];
  for (const f of json) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const p of [scratch, out, harness]) for (const form of forms(p)) assert.ok(!text.toLowerCase().includes(form.toLowerCase()), `${f} cites the scratch path ${form}`);
    assert.deepEqual(guardHits(text), [], `${f}: the secrets guard refuses a long hex blob`);
  }

  // What each rewritten citation became: the installed sibling, a loop-bundle member, a gone temp file; a live path stays.
  const rec = JSON.parse(fs.readFileSync(path.join(dir, 'SignInBase#sign-in-ready--390x844--light.json'), 'utf8'));
  assert.equal(rec.image.path, 'SignInBase#sign-in-ready--390x844--light.png');
  assert.equal(rec.dom.path, 'SignInBase#sign-in-ready--390x844--light.dom.html');
  assert.equal(rec.redline.path, 'SignInBase#sign-in-ready--390x844--light.redline.png');
  assert.equal(rec.redline.rationale, 'SignInBase#sign-in-ready--390x844--light.rationale.json');
  assert.equal(rec.source.component.path, 'SignInBase#sign-in-ready--390x844--light.draw.tsx');
  assert.equal(rec.layout.artwork[0].src, 'temp:nivo-lockup-UPY5CAR6.png');
  assert.equal(rec.source.product, repo, 'a live product path is not scratch: the settle re-measure reads it');
  const score = JSON.parse(fs.readFileSync(path.join(dir, 'SignInBase#sign-in-ready--390x844--light.score.json'), 'utf8'));
  assert.equal(score.file, 'draw-loop:round-1/harness/index.html');
  assert.ok(done.bundle, 'the loop bundle the draw-loop: refs name is cited by generation.loop');
  assert.equal(done.assets[0].generation.loop.sha256, done.bundle);
});
