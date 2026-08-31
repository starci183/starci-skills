import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const reviewRefs = [
  '../skills/starci-fe-process/SKILL.md',
  '../knowledge/ui-render-review.md',
  './test/ui-quality-audit/execute.md',
  './fe/visual-fidelity/execute.md',
];

test('frontend closure requires post-change image review rather than numeric self-certification', () => {
  for (const ref of reviewRefs) {
    const text = readFileSync(new URL(ref, import.meta.url), 'utf8');
    assert.match(text, /full-viewport screenshots/i, ref);
    assert.match(text, /inspect (?:the )?(?:rendered )?images|image review/i, ref);
    assert.match(text, /never close.*(?:DOM|geometry)|(?:DOM|geometry|measurements?).*(?:cannot|can never|only corroborat)/is, ref);
    assert.match(text, /(?:latest source|post-change|latest source mutation)/i, ref);
  }
});

test('visual review records aesthetic evidence and forbids implementer self-certification', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../knowledge/ui-render-review.md', import.meta.url), 'utf8');
  const fidelity = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');
  const independent = readFileSync(new URL('./fe/independent-review/execute.md', import.meta.url), 'utf8');

  for (const [ref, text] of [['skill', skill], ['review', review], ['fidelity', fidelity]]) {
    assert.match(text, /inspection record/i, ref);
    assert.match(text, /surface opacity/i, ref);
    assert.match(text, /content-to-border padding/i, ref);
    assert.match(text, /vertical rhythm/i, ref);
    assert.match(text, /visual[- ]ownership/i, ref);
    assert.match(text, /pinned[- ]boundary[- ]clearance/i, ref);
    assert.match(text, /occlusion/i, ref);
    assert.match(text, /text touching.*(?:border|edge)|content.*showing through.*sticky/is, ref);
  }
  assert.match(skill, /implementer cannot issue the visual verdict/i);
  assert.match(review, /reviewer identity must differ from the implementation identity/i);
  assert.match(independent, /reviewer execution identity must differ from the implementer execution identity/i);
  assert.match(independent, /Missing inspection records.*never `passed`/is);
});

test('visual verdict is blind to implementation evidence and challenges rendered usefulness', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../knowledge/ui-render-review.md', import.meta.url), 'utf8');
  const fidelity = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');
  const independent = readFileSync(new URL('./fe/independent-review/execute.md', import.meta.url), 'utf8');
  const fidelitySchema = JSON.parse(readFileSync(new URL('./fe/visual-fidelity/output.schema.json', import.meta.url), 'utf8'));
  const independentInput = JSON.parse(readFileSync(new URL('./fe/independent-review/input.schema.json', import.meta.url), 'utf8'));

  for (const [ref, text] of [['skill', skill], ['review', review], ['fidelity', fidelity], ['independent', independent]]) {
    assert.match(text, /blind[- ]pixel/i, ref);
    assert.match(text, /source code/i, ref);
    assert.match(text, /(?:semantic utility|user purpose)/i, ref);
    assert.match(text, /(?:meaningless|no understandable user purpose|no user-recognizable job)/i, ref);
    assert.match(text, /(?:dead zone|empty-space balance|large dead zones)/i, ref);
    assert.match(text, /(?:squeezed into compact|wider layout squeezed|desktop merely squeezed)/i, ref);
  }

  const record = fidelitySchema.properties.output.properties.result.anyOf[0]
    .properties.inspectionRecords.items;
  for (const field of ['semanticUtility', 'contentCoherence', 'visualOwnership', 'pinnedBoundaryClearance', 'affordance', 'responsiveComposition', 'visualConsistency', 'emptySpaceBalance']) {
    assert.ok(record.required.includes(field), field);
  }
  assert.equal(independentInput.properties.context.properties.reviewMode.const, 'blind-pixel');
  assert.ok(independentInput.properties.context.required.includes('reviewMode'));
});

test('visual review proves rendered ownership instead of trusting component ancestry', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../knowledge/ui-render-review.md', import.meta.url), 'utf8');
  const fidelity = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');
  const audit = readFileSync(new URL('./test/ui-quality-audit/execute.md', import.meta.url), 'utf8');

  for (const [ref, text] of [['skill', skill], ['review', review], ['fidelity', fidelity], ['audit', audit]]) {
    assert.match(text, /visual[- ]ownership/i, ref);
    assert.match(text, /DOM ancestry|component intent|component contracts/i, ref);
    assert.match(text, /external label row/i, ref);
    assert.match(text, /preceding and following peer|both adjacent peers|wrong sibling/i, ref);
    assert.match(text, /without source knowledge/i, ref);
  }
});

test('visual review rejects flush contact at pinned edges even without overlap', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../knowledge/ui-render-review.md', import.meta.url), 'utf8');
  const fidelity = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');
  const audit = readFileSync(new URL('./test/ui-quality-audit/execute.md', import.meta.url), 'utf8');

  for (const [ref, text] of [['skill', skill], ['review', review], ['fidelity', fidelity], ['audit', audit]]) {
    assert.match(text, /pinned[- ]boundary[- ]clearance/i, ref);
    assert.match(text, /scroll start.*middle.*terminal/is, ref);
    assert.match(text, /(?:no(?: text)?|absence of) overlap.*(?:not enough|does not pass|insufficient|cannot pass)/is, ref);
    assert.match(text, /visibly touch|touching a pinned edge/i, ref);
  }
});

test('frontend authority critiques proposed remedies and preserves semantic UI claims', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../knowledge/ui.md', import.meta.url), 'utf8');
  const collections = readFileSync(new URL('../knowledge/grammar/core/objects/collections.md', import.meta.url), 'utf8');

  assert.match(skill, /user analysis.*evidence.*not automatic implementation authority/is);
  assert.match(skill, /challenge.*glyph.*tone.*business meaning.*reuse contract/is);
  assert.match(ui, /Glyph, shape, tone, and text form one semantic claim/i);
  assert.match(ui, /benefit, capability, promise, or future outcome is neutral content/i);
  assert.match(ui, /Glyph geometry alone does not declare a state/i);
  assert.match(ui, /20px outline `included` circle-check in inherited foreground/i);
  assert.match(ui, /must not reuse `complete`, success, accent tone, or solid weight/i);
  assert.match(ui, /tightly coupled title and explanatory sentence.*`gap-2`/is);
  assert.match(ui, /Category and magnitude labels are not outcome states/i);
  assert.match(ui, /approved Grammar or application authority defines a stable categorical palette/i);
  assert.match(ui, /reuse named tone tokens as visual identity without asserting pass, warning, or failure semantics/i);
  assert.match(ui, /mapping is deterministic across every consumer/i);
  assert.match(collections, /foreground `included` glyph.*not completion or success state/i);
  assert.match(collections, /package accordion primitive.*open\/close motion.*panel lifecycle/is);
  assert.match(collections, /never draw an extra divider between an item's trigger and its own expanded panel/i);
  assert.match(ui, /existing Grammar or application primitive owns the same scroll semantics/i);
  assert.match(collections, /reuse it instead of recreating raw overflow locally/i);
  assert.match(ui, /adjacent siblings together explain one fact.*explicit semantic group/is);
  assert.match(ui, /pinned action projection.*Reserve that boundary exactly once/is);
  assert.match(ui, /page stack gap.*terminal content padding.*blank moat visible at scroll end/is);
  assert.match(ui, /fixed or draggable overlay.*does not reserve terminal document height/is);
  assert.match(ui, /empty document spacer.*duplicates ownership.*false scrollable space/is);
  assert.match(ui, /Disclosure does not erase information load.*only defers it/is);
  assert.match(ui, /split the comparison into a peer surface or a dedicated sheet/is);
  assert.match(ui, /one dominant decision per primary surface/is);
  assert.match(ui, /After splitting an overloaded owner, reselect the interaction container/is);
  assert.match(ui, /short comparison that must be seen together belongs in a static `SurfaceCard`/is);
  assert.match(ui, /accordion is justified only when hiding its content materially reduces task complexity/is);
  assert.match(collections, /ordered progression and current position.*progression anatomy/is);
});

test('frontend review tries to falsify every visual change instead of confirming a baseline', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../knowledge/ui-render-review.md', import.meta.url), 'utf8');
  const fidelity = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');
  const audit = readFileSync(new URL('./test/ui-quality-audit/execute.md', import.meta.url), 'utf8');

  for (const [ref, text] of [['skill', skill], ['review', review], ['fidelity', fidelity], ['audit', audit]]) {
    assert.match(text, /adversarial probe\s+matrix/i, ref);
    assert.match(text, /falsif/i, ref);
    assert.match(text, /breakpoint-adjacent|breakpoint edges/i, ref);
    assert.match(text, /preceding.*following.*siblings.*page terminal/is, ref);
    assert.match(text, /do not stop\s+at the first defect/i, ref);
    assert.match(text, /not-applicable.*(?:exact|ownership reason)/is, ref);
    assert.match(text, /baseline.*(?:never|cannot|do not issue|only)/is, ref);
  }
  assert.match(review, /longest, shortest, missing, dense, sparse, and wrapping content/i);
  assert.match(review, /keyboard\/focus traversal/i);
});

test('confirmed post-completion feedback explains why the prior verdict failed', () => {
  const index = readFileSync(new URL('../INDEX.md', import.meta.url), 'utf8');
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');

  for (const [ref, text] of [['runtime', index], ['frontend skill', skill]]) {
    assert.match(text, /prior (?:decision|claim|verdict)/i, ref);
    assert.match(text, /assumption|incomplete evidence/i, ref);
    assert.match(text, /(?:newly observed|visible) counter(?:example|evidence)|contradiction/i, ref);
    assert.match(text, /missing authority|omitted review|proof check/i, ref);
    assert.match(text, /not hidden reasoning|Never answer.*only an apology/is, ref);
  }
});

test('interactive frontend proof exercises drag scroll zoom and restoration', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../knowledge/ui-render-review.md', import.meta.url), 'utf8');

  assert.match(skill, /edge drags, scroll limits, zoom changes, restoration/i);
  assert.match(review, /page scroll at start\/middle\/end and back/i);
  assert.match(review, /draggable controls released against every constraint edge/i);
  assert.match(review, /browser zoom\/text scaling.*restored/i);
  assert.match(review, /off-screen or unrecoverable controls/i);
});

test('frontend design is an enforced repair capture inspect loop', () => {
  const machine = JSON.parse(readFileSync(new URL('../skills/starci-fe-process/machine.json', import.meta.url), 'utf8'));
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const capture = readFileSync(new URL('./fe/render-capture/execute.md', import.meta.url), 'utf8');
  const fidelity = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');

  const targetFor = (state, outcome) => machine.states[state].on.find(
    (edge) => edge.when?.outputEquals?.outcome === outcome,
  )?.target;

  assert.equal(targetFor('apply', 'applied'), 'capture-preflight');
  assert.equal(targetFor('repair', 'repaired'), 'capture-preflight');
  assert.equal(machine.states['capture-preflight'].ref, 'fe/capture-preflight');
  assert.equal(targetFor('capture-preflight', 'ready'), 'capture');
  assert.equal(targetFor('capture', 'captured'), 'visual-fidelity');
  assert.equal(machine.states['visual-fidelity'].ref, 'fe/visual-fidelity');
  assert.equal(targetFor('visual-fidelity', 'repair'), 'score-route');
  assert.equal(targetFor('score-route', 'repair'), 'finding-classify');
  assert.equal(targetFor('score-route', 'reconstruct'), 'dominant-generate');
  assert.equal(targetFor('finding-classify', 'repair'), 'repair');
  assert.equal(targetFor('finding-classify', 'authority-repair'), 'authority-reconcile');
  assert.equal(targetFor('finding-classify', 'clean'), undefined);
  assert.equal(targetFor('authority-reconcile', 'reconciled'), 'repair');
  assert.equal(targetFor('visual-fidelity', 'passed'), 'quality-handoff');
  assert.equal(targetFor('classify', 'no-change'), 'capture-preflight');
  assert.match(skill, /apply\/repair -> capture-preflight -> render-capture -> one fresh Sol visual-fidelity -> audit-route -> quality-handoff/i);
  assert.match(capture, /render-state matrix/i);
  assert.match(fidelity, /every cell in the frozen render-state matrix/i);
  assert.match(fidelity, /CSS tests.*can never.*visual `passed`/is);
});

test('visual proof covers the delivered state instead of only a convenient overlay', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../knowledge/ui-render-review.md', import.meta.url), 'utf8');
  const uat = readFileSync(new URL('./test/uat-ui-proof/execute.md', import.meta.url), 'utf8');
  for (const [ref, text] of [['skill', skill], ['review', review], ['uat', uat]]) {
    assert.match(text, /entry, task, pending, recovery, result, (?:and )?exit/is, ref);
    assert.match(text, /handoff state/i, ref);
    assert.match(text, /overlay.*(?:does not|doesn't|not).*obscured.*surface/is, ref);
  }
});

test('capture and visual review schemas require latest-source raster evidence', () => {
  const captureInput = JSON.parse(readFileSync(new URL('./fe/render-capture/input.schema.json', import.meta.url), 'utf8'));
  const captureOutput = JSON.parse(readFileSync(new URL('./fe/render-capture/output.schema.json', import.meta.url), 'utf8'));
  const fidelityInput = JSON.parse(readFileSync(new URL('./fe/visual-fidelity/input.schema.json', import.meta.url), 'utf8'));
  const fidelityOutput = JSON.parse(readFileSync(new URL('./fe/visual-fidelity/output.schema.json', import.meta.url), 'utf8'));
  const independentInput = JSON.parse(readFileSync(new URL('./fe/independent-review/input.schema.json', import.meta.url), 'utf8'));

  assert.ok(captureInput.properties.context.required.includes('sourceFingerprint'));
  assert.ok(captureInput.properties.input.required.includes('renderStates'));
  assert.ok(captureInput.properties.input.required.includes('viewports'));
  assert.ok(captureInput.properties.input.required.includes('handoffStateRef'));
  assert.ok(captureInput.properties.input.required.includes('handoffViewport'));
  assert.equal(captureInput.properties.input.properties.handoffViewport.properties.viewportOverride.const, false);
  assert.ok(captureInput.properties.input.required.includes('adversarialProbes'));
  assert.deepEqual(captureInput.properties.input.properties.viewports.items.enum, ['wide', 'intermediate', 'compact']);
  assert.equal(captureInput.properties.input.properties.adversarialProbes.minItems, 10);

  const captureResult = captureOutput.properties.output.properties.result.anyOf[0];
  assert.ok(captureResult.required.includes('sourceFingerprint'));
  for (const field of ['latestMutationFingerprint','latestMutationAt','capturedAt','blindReviewPacketRef','blindReviewPacketFingerprint']) assert.ok(captureResult.required.includes(field));
  assert.ok(captureResult.required.includes('renderMatrix'));
  assert.ok(captureResult.required.includes('adversarialProbeMatrix'));
  assert.ok(captureResult.required.includes('handoffHostArtifact'));
  assert.equal(captureResult.properties.handoffHostArtifact.properties.viewportOverride.const, false);
  assert.match(captureResult.properties.handoffHostArtifact.properties.imageRef.pattern, /png/);
  assert.match(captureResult.properties.renderMatrix.items.properties.imageRef.pattern, /png/);
  assert.equal(captureResult.properties.renderMatrix.contains.properties.handoffState.const, true);
  assert.deepEqual(
    captureResult.properties.adversarialProbeMatrix.items.properties.outcome.enum,
    ['survived', 'contradiction', 'not-applicable'],
  );

  for (const field of ['implementerExecutionRef','reviewerExecutionRef','implementerPrincipalFingerprint','reviewerPrincipalFingerprint','reviewerContextFingerprint','reviewerModel','reviewerCount','contextIsolation','forkTurns','debug']) assert.ok(fidelityInput.properties.context.required.includes(field));
  assert.equal(fidelityInput.properties.context.properties.reviewerModel.const, 'gpt-5.6-sol');
  assert.equal(fidelityInput.properties.context.properties.reviewerCount.const, 1);
  assert.equal(fidelityInput.properties.context.properties.contextIsolation.const, 'fresh');
  assert.equal(fidelityInput.properties.context.properties.forkTurns.const, 'none');
  assert.deepEqual(fidelityInput.properties.input.required, ['auditTargetScore','blindReviewPacket']);
  const packet=fidelityInput.properties.input.properties.blindReviewPacket;
  assert.ok(packet.required.includes('lastScreenshotRef'));
  assert.ok(packet.required.includes('captureReceiptId'));
  assert.match(packet.properties.rasterCells.items.properties.imageRef.pattern, /png/);
  assert.equal(packet.properties.rasterCells.allOf.find((rule)=>rule.maxContains === 1).maxContains, 1);

  const fidelityResult = fidelityOutput.properties.output.properties.result.anyOf[0];
  assert.ok(fidelityResult.required.includes('probeRecords'));
  for (const field of ['packetFingerprint','packetRasterRefs','reviewerExecutionRef','reviewerModel','reviewerCount','contextIsolation','forkTurns','lastScreenshotRef','lastScreenshotVerdict','uncertainty','auditScore']) assert.ok(fidelityResult.required.includes(field));
  assert.equal(fidelityResult.properties.probeRecords.minItems, 10);
  assert.ok(independentInput.properties.input.required.includes('adversarialProbeRecordsRef'));
  assert.ok(independentInput.properties.input.required.includes('handoffHostArtifactRef'));
});

test('handoff review certifies the delivered host surface instead of a detached viewport', () => {
  const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../knowledge/ui-render-review.md', import.meta.url), 'utf8');
  const capture = readFileSync(new URL('./fe/render-capture/execute.md', import.meta.url), 'utf8');
  const fidelity = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');
  const independent = readFileSync(new URL('./fe/independent-review/execute.md', import.meta.url), 'utf8');
  const uat = readFileSync(new URL('./test/uat-ui-proof/execute.md', import.meta.url), 'utf8');
  for (const [ref,text] of [['skill',skill],['review',review],['capture',capture],['fidelity',fidelity],['independent',independent],['uat',uat]]) {
    assert.match(text,/host-context/i,ref);
    assert.match(text,/no viewport override|without a viewport override|with no viewport override/i,ref);
    assert.match(text,/detached|differently sized|narrower in-app panel/i,ref);
  }
});
