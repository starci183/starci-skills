// _tinkle6-add-route.mjs — append the mandatory `route:` resolver block to each
// modules/ops/ops/<id>.yaml (tinkle-1 omitted the amendment requirement; tinkle-6
// fills it so route-op.mjs can route without reading whole files).
// Appends raw yaml text — a re-serialize would strip the catalog's comments.
// Table values derive from each op's nodeKinds + modules/ops/registry.yaml
// lifecyclePosition/kindInferred (tinkle-1's marked inference) — sources cited
// in each block's comment.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const opsDir = path.join(skillRoot, 'modules', 'ops', 'ops');

// id -> {phase[], intent[], prerequisites[], riskHints[]}
// phase vocabulary: stage id (intake|scope|decide|direct|implement|verify|release|operate)
// + coarse lifecycle term (pre-implementation|implementation|post-implementation|cross-cutting)
const TABLE = {
  'request.analyze':    { phase: ['intake', 'pre-implementation'], intent: ['analyze', 'intake', 'classify', 'read-only'], prerequisites: [], riskHints: [] },
  'task.execute':       { phase: ['intake', 'pre-implementation'], intent: ['task', 'execute', 'ad-hoc', 'direct-task'], prerequisites: ['no preset workflow matched'], riskHints: [] },
  'scope.define':       { phase: ['scope', 'pre-implementation'], intent: ['scope', 'define', 'bound'], prerequisites: ['request analyzed'], riskHints: [] },
  'workspace.manage':   { phase: ['scope', 'pre-implementation'], intent: ['workspace', 'manage', 'bootstrap', 'import', 'bind'], prerequisites: [], riskHints: ['work-tree-writes'] },
  'work.author':        { phase: ['scope', 'pre-implementation'], intent: ['work', 'author', 'nodes', 'launchable', 'decompose'], prerequisites: ['scope defined'], riskHints: [] },
  'business.decide':    { phase: ['decide', 'pre-implementation'], intent: ['business', 'srs', 'requirements', 'decide'], prerequisites: ['scope defined'], riskHints: [] },
  'architecture.decide':{ phase: ['decide', 'pre-implementation'], intent: ['architecture', 'sds', 'design', 'contracts', 'decide'], prerequisites: ['business.decide done (accepted SRS)'], riskHints: [] },
  'brand.decide':       { phase: ['decide', 'pre-implementation'], intent: ['brand', 'identity', 'tokens', 'decide'], prerequisites: ['scope defined'], riskHints: ['generates-assets'] },
  'decision.prepare':   { phase: ['decide', 'cross-cutting'], intent: ['decision', 'prepare', 'owner-question'], prerequisites: ['a decidable question raised by another op'], riskHints: [] },
  'provision.ask':      { phase: ['decide', 'cross-cutting'], intent: ['provision', 'ask', 'owner-input', 'credential'], prerequisites: ['an owner-only input is needed'], riskHints: ['waits-on-owner'] },
  'interface.draw':     { phase: ['direct', 'pre-implementation'], intent: ['direction', 'draw', 'imagegen', 'ui-design'], prerequisites: ['business.decide done', 'architecture.decide done', 'brand.decide done'], riskHints: ['host-tool-required:image_gen.imagegen'] },
  'interface.asset':    { phase: ['implement', 'implementation'], intent: ['asset', 'image', 'artwork', 'imagegen'], prerequisites: ['interface.draw done (artworkSlots declared)'], riskHints: ['host-tool-required:image_gen.imagegen'] },
  'interface.implement':{ phase: ['implement', 'implementation'], intent: ['implement', 'frontend', 'ui', 'code'], prerequisites: ['interface.draw done', 'architecture.decide done'], riskHints: ['source-edits'] },
  'backend.implement':  { phase: ['implement', 'implementation'], intent: ['implement', 'backend', 'code', 'api', 'build'], prerequisites: ['business.decide done', 'architecture.decide done'], riskHints: ['source-edits'] },
  'code.refactor':      { phase: ['implement', 'implementation'], intent: ['refactor', 'cleanup', 'maintenance'], prerequisites: ['delivered code + existing regression coverage'], riskHints: ['source-edits'] },
  'content.generate':   { phase: ['implement', 'implementation'], intent: ['content', 'copy', 'write'], prerequisites: ['decided records/behavior exist'], riskHints: [] },
  'docs.author':        { phase: ['implement', 'implementation'], intent: ['docs', 'documentation', 'write'], prerequisites: ['decided records/behavior exist'], riskHints: [] },
  'grammar.update':     { phase: ['implement', 'implementation'], intent: ['grammar', 'update', 'component-library'], prerequisites: ['a recorded failed composition'], riskHints: ['runtime-self-edit'] },
  'knowledge.repair':   { phase: ['implement', 'cross-cutting'], intent: ['knowledge', 'repair', 'rules', 'maintenance'], prerequisites: ['evidence challenging a rule'], riskHints: ['runtime-self-edit'] },
  'test.author':        { phase: ['implement', 'implementation'], intent: ['test', 'author', 'coverage'], prerequisites: ['test-gap blocker or code under test'], riskHints: [] },
  'e2e.verify':         { phase: ['verify', 'post-implementation'], intent: ['e2e', 'api', 'verify', 'test'], prerequisites: ['implementation done'], riskHints: ['served-target'] },
  'integration.verify': { phase: ['verify', 'post-implementation'], intent: ['integration', 'live-provider', 'verify'], prerequisites: ['implementation done'], riskHints: ['external-effects', 'live-provider', 'high-kind'] },
  'perf.verify':        { phase: ['verify', 'post-implementation'], intent: ['perf', 'performance', 'measure', 'verify'], prerequisites: ['implementation done'], riskHints: [] },
  'security.verify':    { phase: ['verify', 'post-implementation'], intent: ['security', 'verify', 'scan'], prerequisites: ['a delivered slice'], riskHints: [] },
  'review.verify':      { phase: ['verify', 'post-implementation'], intent: ['review', 'verify', 'audit', 'delivery'], prerequisites: ['a delivery to inspect'], riskHints: [] },
  'uat.verify':         { phase: ['verify', 'post-implementation'], intent: ['uat', 'acceptance', 'browser', 'verify'], prerequisites: ['implementation done', 'verified served build'], riskHints: ['browser-required'] },
  'release.deliver':    { phase: ['release', 'post-implementation'], intent: ['release', 'publish', 'deploy', 'migrate'], prerequisites: ['implementation + verification evidence'], riskHints: ['external-effects', 'terminal', 'high-kind'] },
  'runtime.operate':    { phase: ['operate', 'cross-cutting'], intent: ['runtime', 'serve', 'inspect', 'environment', 'service'], prerequisites: ['a declared stack/environment'], riskHints: ['runtime-effects'] },
  'goal.revise':        { phase: ['decide', 'cross-cutting'], intent: ['goal', 'revise', 'amendment'], prerequisites: ['an approved goal exists'], riskHints: [] },
  'scope.retire':       { phase: ['operate', 'post-implementation'], intent: ['retire', 'remove', 'scope', 'end-of-life'], prerequisites: ['the scope exists'], riskHints: ['destructive-gate'] },
};

let done = 0, skipped = [];
for (const [id, r] of Object.entries(TABLE)) {
  const file = path.join(opsDir, `${id}.yaml`);
  if (!fs.existsSync(file)) { skipped.push(`${id}: file missing`); continue; }
  const text = fs.readFileSync(file, 'utf8');
  if (/^route:/m.test(text)) { skipped.push(`${id}: route already present`); continue; }
  const q = s => `"${s}"`;
  const block = [
    '',
    '# ---------------------------------------------------------------------------',
    '# route: resolver index (added by tinkle-6 per tinkle/_common.md amendment).',
    '# Keys derive from this op\'s nodeKinds + modules/ops/registry.yaml',
    '# lifecyclePosition/kindInferred. scripts/route/route-op.mjs matches on this',
    '# block alone — an agent never reads the whole contract to route.',
    'route:',
    `  nodeKinds: ${JSON.stringify(r.nodeKinds ?? null) === 'null' ? '[]' : ''}`,
  ].filter(Boolean);
  // fill nodeKinds from the file's own field
  const m = text.match(/^nodeKinds:\s*\[([^\]]*)\]/m);
  const nk = m ? `[${m[1].trim()}]` : '[]';
  block[block.length - 1] = `  nodeKinds: ${nk}`;
  block.push(`  phase: [${r.phase.join(', ')}]`);
  block.push(`  intent: [${r.intent.join(', ')}]`);
  block.push(`  prerequisites: [${r.prerequisites.map(q).join(', ')}]`);
  if (r.riskHints.length) block.push(`  riskHints: [${r.riskHints.join(', ')}]`);
  fs.writeFileSync(file, text.replace(/\s*$/, '\n') + block.join('\n') + '\n');
  done++;
}
console.log(`route blocks appended: ${done}`);
for (const s of skipped) console.log(`skipped: ${s}`);
