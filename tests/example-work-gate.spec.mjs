import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { checkWorkTree, checkFamiliesDrift, FAMILIES } from '../scripts/checks/check-example-work.mjs';

/**
 * One fixture tree per new-concept rule in scripts/checks/check-example-work.mjs, proving each rule refuses the
 * exact malformed shape it targets - and, where useful, that the corrected shape is accepted. Fixtures live
 * on the same drive as the repo (never os.tmpdir(), which can be a different drive on this host and break
 * relative path handling used elsewhere in the toolchain).
 */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `gate-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

/** Builds a minimal-but-valid .starciwork tree; `extra` maps additional relative paths to YAML content. */
function tree(extra) {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  for (const [rel, content] of Object.entries(extra)) write(workRoot, rel, content);
  return workRoot;
}

function refusalsFor(extra) {
  const workRoot = tree(extra);
  const problems = [];
  checkWorkTree(workRoot, problems);
  return problems;
}

test('nested work/node specification records are not forced through compact flat-family identity rules', () => {
  const problems = refusalsFor({
    'features/chatbot/business/index.yaml': 'schema: work/node@1\nid: chatbot.business\nkind: business\nrequired: true\n',
    'features/chatbot/business/overview/index.yaml': 'schema: work/node@1\nid: chatbot.business.overview\nkind: business-overview\nrequired: true\nstate: todo\n',
    'features/chatbot/business/srs/index.yaml': 'schema: work/node@1\nid: chatbot.business.srs\nkind: business\nrequired: true\nextensions:\n  work3:\n    srs:\n      schema: starci/srs-aggregate@1\n',
    'features/chatbot/architecture/sds/components/router/index.yaml': 'schema: work/node@2\nid: chatbot.architecture.sds.component.router\nkind: architecture\nrequired: true\nstate: done\n',
    'features/chatbot/implementation/frontend/shell/evidence/proof/manifest.yaml': 'schema: work/evidence@1\nid: proof.chatbot.shell\nnodeId: chatbot.shell\noutcome: pass\nassets: []\n',
    'kernel-strays/retired-copy/features/chatbot/fr/broken/index.yaml': 'schema: work/functional-requirement@1\nid: wrong\nstate: done\n',
  });
  assert.equal(problems.filter(problem => problem.includes('no record family in its path') || problem.includes('but its place says') || problem.includes('state is done with no sibling evidence.yaml')).length, 0, problems.join('\n'));
});

test('concept 1: blocker edges - prose blockedBy is refused, dangling target is refused, a stale (done) blocker is refused', () => {
  const proseOnly = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nblockedBy:\n  - a plain sentence naming nothing\n',
  });
  assert.ok(proseOnly.some(p => p.includes('blockedBy carries a prose string')), proseOnly.join('\n'));

  const danglingTarget = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.ghost, because: "waiting"}\n',
  });
  assert.ok(danglingTarget.some(p => p.includes('blockedBy target br.f.ghost does not exist')), danglingTarget.join('\n'));

  const stale = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.other, rev: 1, because: "waiting on other"}\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: done\nchange: {rev: 1, kind: initial, at: 2026-01-01T00:00:00.000Z}\nverificationSource: authored-claim\nbecause: claimed\n',
  });
  assert.ok(stale.some(p => p.includes('blockedBy on br.f.other is stale')), stale.join('\n'));

  const fresh = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.other, because: "waiting on other"}\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: todo\n',
  });
  assert.equal(fresh.length, 0, fresh.join('\n'));
});

test('concept 2: gap records need a valid state, a statement, and a resolving closedBy', () => {
  const badState = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: maybe\nstatement: something is missing\n',
  });
  assert.ok(badState.some(p => p.includes('work/gap@1 state must be todo or done')), badState.join('\n'));

  const noStatement = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: todo\n',
  });
  assert.ok(noStatement.some(p => p.includes('work/gap@1 needs a statement')), noStatement.join('\n'));

  const badClosedBy = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: todo\nstatement: s\nclosedBy: br.f.ghost\n',
  });
  assert.ok(badClosedBy.some(p => p.includes('closedBy names br.f.ghost')), badClosedBy.join('\n'));
});

test('trust concept 8: a done implementation is refused when its ui direction is not done yet (IMPL_BEFORE_DIRECTION)', () => {
  // proves a ui-screen directly, by id, that is not done
  const provesTodoUi = refusalsFor({
    'workspace.yaml': 'schema: work/workspace@1\nid: fixture\nrepositories: [{role: be, name: app}, {role: fe, name: app-frontend}]\n',
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: done\nrepository: app-frontend\nowners: [{role: block, path: src/f}]\nproves: [ui.f.screen]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/ui/screen/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.screen\ntitle: t\nstate: todo\n',
  });
  assert.ok(provesTodoUi.some(p => p.includes('IMPL_BEFORE_DIRECTION') && p.includes('ui.f.screen')), provesTodoUi.join('\n'));

  // frontend repository, proves nothing by id - falls back to every ui-screen the feature owns
  const frontendNoProves = refusalsFor({
    'workspace.yaml': 'schema: work/workspace@1\nid: fixture\nrepositories: [{role: be, name: app}, {role: fe, name: app-frontend}]\n',
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: done\nrepository: app-frontend\nowners: [{role: block, path: src/f}]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/ui/screen/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.screen\ntitle: t\nstate: todo\n',
  });
  assert.ok(frontendNoProves.some(p => p.includes('IMPL_BEFORE_DIRECTION') && p.includes('ui.f.screen')), frontendNoProves.join('\n'));

  // the ui-screen is done - accepted
  const uiDone = refusalsFor({
    'workspace.yaml': 'schema: work/workspace@1\nid: fixture\nrepositories: [{role: be, name: app}, {role: fe, name: app-frontend}]\n',
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: done\nrepository: app-frontend\nowners: [{role: block, path: src/f}]\nproves: [ui.f.screen]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/ui/screen/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.screen\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
  });
  assert.equal(uiDone.filter(p => p.includes('IMPL_BEFORE_DIRECTION')).length, 0, uiDone.join('\n'));

  // a backend implementation with no ui in its proves is untouched by this rule
  const backendUntouched = refusalsFor({
    'workspace.yaml': 'schema: work/workspace@1\nid: fixture\nrepositories: [{role: be, name: app}, {role: fe, name: app-frontend}]\n',
    'features/f/impl/y/index.yaml': 'schema: work/implementation@1\nid: impl.f.y\ntitle: t\nstate: done\nrepository: app\nowners: [{role: module, path: src/f}]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/ui/screen/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.screen\ntitle: t\nstate: todo\n',
  });
  assert.equal(backendUntouched.filter(p => p.includes('IMPL_BEFORE_DIRECTION')).length, 0, backendUntouched.join('\n'));
});

test('trust concept 5: a blockedBy cycle is refused (BLOCKER_CYCLE), and a chain rooted in a gap or an open decision is accepted', () => {
  const cyclic = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.b, because: "waiting on b"}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule@1\nid: br.f.b\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.a, because: "waiting on a"}\n',
  });
  assert.ok(cyclic.some(p => p.includes('BLOCKER_CYCLE') && p.includes('br.f.a') && p.includes('br.f.b')), cyclic.join('\n'));

  const rootedInGap = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: todo\nstatement: s\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nblockedBy:\n  - {record: gap.f.absence, because: "waiting on the gap"}\n',
  });
  assert.equal(rootedInGap.filter(p => p.includes('BLOCKER')).length, 0, rootedInGap.join('\n'));

  const rootedInOpenDecision = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision@1\nid: decision.f.d\ntitle: t\nstate: todo\noutcome: open\noptions: [{id: a, consequence: c}]\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nblockedBy:\n  - {record: decision.f.d, because: "waiting on the decision"}\n',
  });
  assert.equal(rootedInOpenDecision.filter(p => p.includes('BLOCKER')).length, 0, rootedInOpenDecision.join('\n'));
});

test('trust concept 5: a blockedBy chain that dead-ends at an ordinary record (neither cyclic nor gap/open-decision rooted) is warned, not refused (BLOCKER_UNROOTED)', () => {
  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.b, because: "waiting on b, which is itself unblocked and unfinished"}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule@1\nid: br.f.b\ntitle: t\nstate: todo\n',
  });
  const problems = [];
  const warnings = [];
  checkWorkTree(workRoot, problems, warnings);
  assert.equal(problems.filter(p => p.includes('BLOCKER')).length, 0, problems.join('\n'));
  assert.ok(warnings.some(w => w.includes('BLOCKER_UNROOTED') && w.includes('br.f.b')), warnings.join('\n'));

  // A decided (not open) decision is not a valid root either.
  const workRoot2 = tree({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision@1\nid: decision.f.d\ntitle: t\nstate: done\noutcome: decided\nchosen: a\noptions: [{id: a, consequence: c}]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nblockedBy:\n  - {record: decision.f.d, because: "waiting on the (now settled) decision"}\n',
  });
  const warnings2 = [];
  checkWorkTree(workRoot2, [], warnings2);
  assert.ok(warnings2.some(w => w.includes('BLOCKER_UNROOTED') && w.includes('decision.f.d')), warnings2.join('\n'));
});

test('trust concept 1: a stale codeDigest is refused unless the evidence carries stale: true (CODE_DIGEST_STALE)', () => {
  const workRoot = tree({
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: done\nrepository: r\nowners: [{role: module, path: src/f}]\nverificationSource: authored-claim\nbecause: c\n',
  });
  write(workRoot, 'features/f/impl/x/evidence.yaml',
    'schema: work/evidence@1\nrecord: impl.f.x\noutcome: pass\ncodeDigest: {algorithm: sha256, files: [], digest: "deadbeef00000000000000000000000000000000000000000000000000000000"}\n');
  write(path.dirname(workRoot), 'src/f/a.ts', 'export const a = 1;\n');
  const stale = [];
  checkWorkTree(workRoot, stale);
  assert.ok(stale.some(p => p.includes('CODE_DIGEST_STALE')), stale.join('\n'));

  fs.writeFileSync(path.join(workRoot, 'features/f/impl/x/evidence.yaml'),
    'schema: work/evidence@1\nrecord: impl.f.x\noutcome: pass\nstale: true\ncodeDigest: {algorithm: sha256, files: [], digest: "deadbeef00000000000000000000000000000000000000000000000000000000"}\n', 'utf8');
  const markedStale = [];
  checkWorkTree(workRoot, markedStale);
  assert.equal(markedStale.filter(p => p.includes('CODE_DIGEST_STALE')).length, 0, markedStale.join('\n'));
});

test('trust concept 2: an evidence assertion without a command is refused as not replayable (PROOF_NOT_REPLAYABLE)', () => {
  const workRoot = tree({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement@1\nid: fr.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
  });
  write(workRoot, 'features/f/fr/x/evidence.yaml',
    'schema: work/evidence@1\nrecord: fr.f.x\noutcome: pass\nassertions:\n  - {id: ac.f.x.a, outcome: pass, observation: "it passed, trust me"}\n');
  const problems = [];
  checkWorkTree(workRoot, problems);
  assert.ok(problems.some(p => p.includes('PROOF_NOT_REPLAYABLE')), problems.join('\n'));

  fs.writeFileSync(path.join(workRoot, 'features/f/fr/x/evidence.yaml'),
    'schema: work/evidence@1\nrecord: fr.f.x\noutcome: pass\nassertions:\n  - {id: ac.f.x.a, command: "npm test", exit: 0, outcome: pass, observation: "npm test exited 0"}\n', 'utf8');
  const withCommand = [];
  checkWorkTree(workRoot, withCommand);
  assert.equal(withCommand.filter(p => p.includes('PROOF_NOT_REPLAYABLE')).length, 0, withCommand.join('\n'));
});

test('trust concept 3: a done record\'s proves target must itself be done (PROVES_TARGET_NOT_DONE)', () => {
  const workRoot = tree({
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: done\nrepository: r\nowners: [{role: module, path: src/f}]\nproves: [br.f.a]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\n',
  });
  fs.mkdirSync(path.join(path.dirname(workRoot), 'src', 'f'), {recursive: true});
  const notDone = [];
  checkWorkTree(workRoot, notDone);
  assert.ok(notDone.some(p => p.includes('proves br.f.a, which is todo, not done [PROVES_TARGET_NOT_DONE]')), notDone.join('\n'));

  fs.writeFileSync(path.join(workRoot, 'features/f/br/a/index.yaml'), 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n', 'utf8');
  const done = [];
  checkWorkTree(workRoot, done);
  assert.equal(done.filter(p => p.includes('PROVES_TARGET_NOT_DONE')).length, 0, done.join('\n'));
});

test('trust concept 3: owners[]/module paths that do not exist on disk are refused for done records and warned for todo ones (OWNER_PATH_MISSING)', () => {
  const workRoot = tree({
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: done\nrepository: r\nowners: [{role: module, path: src/ghost}]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/impl/y/index.yaml': 'schema: work/implementation@1\nid: impl.f.y\ntitle: t\nstate: todo\nrepository: r\nowners: [{role: module, path: src/ghost}]\n',
  });
  const problems = [];
  const warnings = [];
  checkWorkTree(workRoot, problems, warnings);
  assert.ok(problems.some(p => p.includes('impl/x') && p.includes('OWNER_PATH_MISSING')), problems.join('\n'));
  assert.ok(!problems.some(p => p.includes('impl/y')), problems.join('\n'));
  assert.ok(warnings.some(w => w.includes('impl/y') && w.includes('OWNER_PATH_MISSING')), warnings.join('\n'));

  // a file path (not a bare directory) normalises to its dirname (moduleRootOf) - and an existing dir,
  // named with a trailing /** glob, resolves clean with no problem or warning at all.
  const workRoot2 = tree({
    'features/f/impl/z/index.yaml': 'schema: work/implementation@1\nid: impl.f.z\ntitle: t\nstate: done\nrepository: r\nowners: [{role: module, path: src/real/**}]\nverificationSource: authored-claim\nbecause: c\n',
  });
  fs.mkdirSync(path.join(path.dirname(workRoot2), 'src', 'real'), {recursive: true});
  const problems2 = [];
  const warnings2 = [];
  checkWorkTree(workRoot2, problems2, warnings2);
  assert.equal(problems2.length, 0, problems2.join('\n'));
  assert.equal(warnings2.length, 0, warnings2.join('\n'));
});

test('trust concept 4: a done sds-component needs owners naming an existing module directory; a todo one without owners is only warned', () => {
  const workRoot = tree({
    'features/f/sds/a/index.yaml': 'schema: work/sds-component@1\nid: sds.f.a\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/sds/b/index.yaml': 'schema: work/sds-component@1\nid: sds.f.b\ntitle: t\nstate: todo\n',
  });
  const problems = [];
  const warnings = [];
  checkWorkTree(workRoot, problems, warnings);
  assert.ok(problems.some(p => p.includes('sds/a') && p.includes('no owners naming a module directory')), problems.join('\n'));
  assert.ok(!problems.some(p => p.includes('sds/b')), problems.join('\n'));
  assert.ok(warnings.some(w => w.includes('sds/b') && w.includes('no owners naming a module directory')), warnings.join('\n'));

  const workRoot2 = tree({
    'features/f/sds/c/index.yaml': 'schema: work/sds-component@1\nid: sds.f.c\ntitle: t\nstate: done\nowners: [{role: module, path: src/real}]\nverificationSource: authored-claim\nbecause: c\n',
  });
  fs.mkdirSync(path.join(path.dirname(workRoot2), 'src', 'real'), {recursive: true});
  const problems2 = [];
  checkWorkTree(workRoot2, problems2);
  assert.equal(problems2.filter(p => p.includes('sds-component')).length, 0, problems2.join('\n'));
});

test('concept 7: gap.closedBy accepts a bare id (normalised to one entry) or a list, every entry must resolve, and a done gap needs every closer done', () => {
  const bareStringOk = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: todo\nstatement: s\nclosedBy: impl.f.thing\n',
    'features/f/impl/thing/index.yaml': 'schema: work/implementation@1\nid: impl.f.thing\ntitle: t\nstate: todo\nrepository: r\nowners: [{role: module, path: src/f}]\n',
  });
  assert.equal(bareStringOk.length, 0, bareStringOk.join('\n'));

  const listOneMissing = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: todo\nstatement: s\nclosedBy: [impl.f.thing, impl.f.ghost]\n',
    'features/f/impl/thing/index.yaml': 'schema: work/implementation@1\nid: impl.f.thing\ntitle: t\nstate: todo\nrepository: r\nowners: [{role: module, path: src/f}]\n',
  });
  assert.ok(listOneMissing.some(p => p.includes('closedBy names impl.f.ghost, which no record owns')), listOneMissing.join('\n'));

  const doneButOneCloserNotDone = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: done\nstatement: s\nclosedBy: [impl.f.a, impl.f.b]\n',
    'features/f/impl/a/index.yaml': 'schema: work/implementation@1\nid: impl.f.a\ntitle: t\nstate: done\nrepository: r\nowners: [{role: module, path: src/f}]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/impl/b/index.yaml': 'schema: work/implementation@1\nid: impl.f.b\ntitle: t\nstate: todo\nrepository: r\nowners: [{role: module, path: src/f}]\n',
  });
  assert.ok(doneButOneCloserNotDone.some(p => p.includes("closedBy's impl.f.b is todo, not done")), doneButOneCloserNotDone.join('\n'));

  const doneWithBothClosersDone = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: done\nstatement: s\nclosedBy: [impl.f.a, impl.f.b]\nverificationSource: authored-claim\nbecause: closed\n',
    'features/f/impl/a/index.yaml': 'schema: work/implementation@1\nid: impl.f.a\ntitle: t\nstate: done\nrepository: r\nowners: [{role: module, path: src/f}]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/impl/b/index.yaml': 'schema: work/implementation@1\nid: impl.f.b\ntitle: t\nstate: done\nrepository: r\nowners: [{role: module, path: src/f}]\nverificationSource: authored-claim\nbecause: c\n',
  });
  assert.equal(doneWithBothClosersDone.filter(p => p.includes('gap')).length, 0, doneWithBothClosersDone.join('\n'));
});

test('concept 3: conflictsWith rev must match; tension is refused off policy-decision and needs 2+ ids', () => {
  const revMismatch = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nconflictsWith:\n  - {record: br.f.b, rev: 5, because: "x"}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule@1\nid: br.f.b\ntitle: t\nstate: todo\nchange: {rev: 1, kind: initial, at: 2026-01-01T00:00:00.000Z}\n',
  });
  assert.ok(revMismatch.some(p => p.includes('conflictsWith cites br.f.b at rev 5')), revMismatch.join('\n'));

  const tensionOffDecision = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\ntension: {records: [br.f.a, br.f.b], statement: s}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule@1\nid: br.f.b\ntitle: t\nstate: todo\n',
  });
  assert.ok(tensionOffDecision.some(p => p.includes('tension is only authored on work/policy-decision@1')), tensionOffDecision.join('\n'));

  const tensionTooFew = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision@1\nid: decision.f.d\ntitle: t\nstate: todo\noutcome: open\ntension: {records: [br.f.a], statement: s}\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\n',
  });
  assert.ok(tensionTooFew.some(p => p.includes('tension.records needs at least two')), tensionTooFew.join('\n'));
});

test('concept 4: decision outcome is closed, chosen must resolve to an option, targetModule is refused', () => {
  const badOutcome = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision@1\nid: decision.f.d\ntitle: t\nstate: done\noutcome: skip-it\noptions:\n  - {id: skip-it, consequence: c}\n',
  });
  assert.ok(badOutcome.some(p => p.includes('outcome must be open or decided')), badOutcome.join('\n'));

  const chosenNotAnOption = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision@1\nid: decision.f.d\ntitle: t\nstate: done\noutcome: decided\nchosen: not-listed\noptions:\n  - {id: real-option, consequence: c}\n',
  });
  assert.ok(chosenNotAnOption.some(p => p.includes('is not one of options')), chosenNotAnOption.join('\n'));

  const hasTargetModule = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision@1\nid: decision.f.d\ntitle: t\nstate: done\noutcome: decided\nchosen: real-option\noptions:\n  - {id: real-option, consequence: c}\ntargetModule: src/wherever\n',
  });
  assert.ok(hasTargetModule.some(p => p.includes('targetModule is not part of the decision vocabulary')), hasTargetModule.join('\n'));
});

test('concept 5: change.kind is a closed enum; a stale recordDigest must carry stale: true', () => {
  const badKind = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nchange: {rev: 1, kind: whimsical, at: 2026-01-01T00:00:00.000Z}\n',
  });
  assert.ok(badKind.some(p => p.includes('change.kind "whimsical"')), badKind.join('\n'));

  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
  });
  write(workRoot, 'features/f/br/a/evidence.yaml', 'schema: work/evidence@1\nrecord: br.f.a\nrecordDigest: "deadbeef00000000000000000000000000000000000000000000000000000000"\noutcome: pass\n');
  const problems = [];
  checkWorkTree(workRoot, problems);
  assert.ok(problems.some(p => p.includes('refused unless it carries stale: true')), problems.join('\n'));

  // now mark it stale and it must be accepted
  fs.writeFileSync(path.join(workRoot, 'features/f/br/a/evidence.yaml'),
    'schema: work/evidence@1\nrecord: br.f.a\nrecordDigest: "deadbeef00000000000000000000000000000000000000000000000000000000"\noutcome: pass\nstale: true\nstaleSince: {record: br.f.a}\n', 'utf8');
  const problems2 = [];
  checkWorkTree(workRoot, problems2);
  assert.equal(problems2.filter(p => p.includes('recordDigest')).length, 0, problems2.join('\n'));

  // and the digest algorithm must be exactly sha256 of the record file's bytes (work-layout contract)
  const recordFile = path.join(workRoot, 'features/f/br/a/index.yaml');
  const digest = crypto.createHash('sha256').update(fs.readFileSync(recordFile)).digest('hex');
  fs.writeFileSync(path.join(workRoot, 'features/f/br/a/evidence.yaml'),
    `schema: work/evidence@1\nrecord: br.f.a\nrecordDigest: ${digest}\noutcome: pass\n`, 'utf8');
  const problems3 = [];
  checkWorkTree(workRoot, problems3);
  assert.equal(problems3.filter(p => p.includes('recordDigest')).length, 0, problems3.join('\n'));
});

test('concept 6: a done record needs evidence or an authored-claim declaration; data/brand/policy-decision are exempt by default', () => {
  const bareDone = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement@1\nid: fr.f.x\ntitle: t\nstate: done\n',
  });
  assert.ok(bareDone.some(p => p.includes('no sibling evidence.yaml and no verificationSource')), bareDone.join('\n'));

  const exemptData = refusalsFor({
    'features/f/data/x/index.yaml': 'schema: work/data@1\nid: data.f.x\ntitle: t\nstate: done\nfields: []\n',
  });
  assert.equal(exemptData.length, 0, exemptData.join('\n'));

  const claimedDone = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement@1\nid: fr.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: agreed by design, not yet run\n',
  });
  assert.equal(claimedDone.length, 0, claimedDone.join('\n'));
});

test('concept 7: appliesTo is refused off business-rule/sds-component (work/data@1 in particular) and its targets must resolve', () => {
  const onData = refusalsFor({
    'features/f/data/x/index.yaml': 'schema: work/data@1\nid: data.f.x\ntitle: t\nstate: done\nfields: []\nappliesTo: [br.f.a]\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\n',
  });
  assert.ok(onData.some(p => p.includes('appliesTo is only authored on work/business-rule@1 or work/sds-component@1, not work/data@1')), onData.join('\n'));

  const danglingTarget = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nappliesTo: [fr.other.ghost]\n',
  });
  assert.ok(danglingTarget.some(p => p.includes('appliesTo names fr.other.ghost')), danglingTarget.join('\n'));

  const onSdsComponent = refusalsFor({
    'features/f/sds/a/index.yaml': 'schema: work/sds-component@1\nid: sds.f.a\ntitle: t\nstate: todo\nappliesTo: [fr.f.b]\n',
    'features/f/fr/b/index.yaml': 'schema: work/functional-requirement@1\nid: fr.f.b\ntitle: t\nstate: todo\n',
  });
  assert.equal(onSdsComponent.length, 0, onSdsComponent.join('\n'));
});

test('concept 8: event needs a resolving producer, non-empty payload and a closed delivery vocabulary; subscribes must target a work/event@1; extends must target a work/data@1; a non-timer object on transitions.on is refused', () => {
  const badEvent = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement@1\nid: fr.f.x\ntitle: t\nstate: todo\n',
    'features/f/event/e/index.yaml': 'schema: work/event@1\nid: event.f.e\ntitle: t\nstate: todo\nproducer: fr.f.ghost\npayload: []\ndelivery: {guarantee: usually, ordering: whenever}\n',
  });
  assert.ok(badEvent.some(p => p.includes('producer "fr.f.ghost" does not resolve')), badEvent.join('\n'));
  assert.ok(badEvent.some(p => p.includes('event needs a non-empty payload')), badEvent.join('\n'));
  assert.ok(badEvent.some(p => p.includes('delivery.guarantee "usually"')), badEvent.join('\n'));
  assert.ok(badEvent.some(p => p.includes('delivery.ordering "whenever"')), badEvent.join('\n'));

  const goodEvent = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement@1\nid: fr.f.x\ntitle: t\nstate: todo\n',
    'features/f/event/e/index.yaml': 'schema: work/event@1\nid: event.f.e\ntitle: t\nstate: todo\nproducer: fr.f.x\npayload: [{name: id, type: text}]\ndelivery: {guarantee: at-least-once, ordering: per-key}\n',
  });
  assert.equal(goodEvent.length, 0, goodEvent.join('\n'));

  const subscribesToNonEvent = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement@1\nid: fr.f.x\ntitle: t\nstate: todo\nsubscribes: [fr.f.x]\n',
  });
  assert.ok(subscribesToNonEvent.some(p => p.includes('is a work/functional-requirement@1, not a work/event@1')), subscribesToNonEvent.join('\n'));

  const extendsNonData = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\n',
    'features/f/data/x/index.yaml': 'schema: work/data@1\nid: data.f.x\ntitle: t\nstate: done\nfields: []\nextends: br.f.a\n',
  });
  assert.ok(extendsNonData.some(p => p.includes('is a work/business-rule@1, not a work/data@1')), extendsNonData.join('\n'));

  const badTimer = refusalsFor({
    'features/f/sds/a/index.yaml': 'schema: work/sds-component@1\nid: sds.f.a\ntitle: t\nstate: todo\nstateMachine: {states: [x, y], initial: x, transitions: [{id: t1, from: x, to: y, on: {notATimer: true}}]}\n',
  });
  assert.ok(badTimer.some(p => p.includes("is an object but not {timer")), badTimer.join('\n'));

  const goodTimer = refusalsFor({
    'features/f/sds/a/index.yaml': 'schema: work/sds-component@1\nid: sds.f.a\ntitle: t\nstate: todo\nstateMachine: {states: [x, y], initial: x, transitions: [{id: t1, from: x, to: y, on: {timer: "5 minutes"}}]}\n',
  });
  assert.equal(goodTimer.length, 0, goodTimer.join('\n'));
});

test('concept 9: work/implementation@1 refuses directory/files/targetFiles and needs role+path on every owner; business-rule.module accepts a string or a list', () => {
  const refused = refusalsFor({
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: r\ndirectory: src/f\nfiles: [a.ts]\n',
  });
  assert.ok(refused.some(p => p.includes('directory/files/targetFiles')), refused.join('\n'));

  const missingRole = refusalsFor({
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: r\nowners:\n  - {path: src/f/a.ts}\n',
  });
  assert.ok(missingRole.some(p => p.includes('owners entry missing role or path')), missingRole.join('\n'));

  const goodOwners = refusalsFor({
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: r\nowners:\n  - {role: module, path: src/f/a.ts}\n  - {role: route, path: app/f/route.tsx}\n',
  });
  assert.equal(goodOwners.length, 0, goodOwners.join('\n'));

  const moduleAsNumber = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nmodule: 12\n',
  });
  assert.ok(moduleAsNumber.some(p => p.includes('module must be a non-empty string or a non-empty list')), moduleAsNumber.join('\n'));

  const moduleAsList = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nmodule: [src/f/route.tsx, src/f/entry.tsx]\n',
  });
  assert.equal(moduleAsList.length, 0, moduleAsList.join('\n'));
});

test('concept 10: a done ui-screen needs an asset carrying image_gen.imagegen generation, and coverage.map must name every listed state', () => {
  const doneNoGeneration = refusalsFor({
    'features/f/ui/x/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\nassets: [{path: assets/a.png, role: direction, provenance: p}]\n',
  });
  assert.ok(doneNoGeneration.some(p => p.includes('no asset carries generation.tool: image_gen.imagegen')), doneNoGeneration.join('\n'));

  const missingCoverage = refusalsFor({
    'features/f/ui/x/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n' +
      'assets: [{path: assets/a.png, role: direction, provenance: p, generation: {tool: image_gen.imagegen, promptPath: assets/a.prompt.txt, inputRefs: []}}]\n' +
      'ui: {intent: i, surfaces: [], states: [{name: empty, trigger: t, behavior: b}, {name: full, trigger: t, behavior: b}], coverage: {scale: bounded, representativeScreens: [x], map: [{screen: x, state: empty, viewport: desktop, components: [], derivation: d}]}, accessibility: [], responsive: [], assets: [], observations: [], gaps: []}\n',
  });
  assert.ok(missingCoverage.some(p => p.includes('coverage.map names no entry for state "full"')), missingCoverage.join('\n'));

  const good = refusalsFor({
    'features/f/ui/x/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n' +
      'assets: [{path: assets/a.png, role: direction, provenance: p, generation: {tool: image_gen.imagegen, promptPath: assets/a.prompt.txt, inputRefs: []}}]\n' +
      'ui: {intent: i, surfaces: [], states: [{name: empty, trigger: t, behavior: b}], coverage: {scale: bounded, representativeScreens: [x], map: [{screen: x, state: empty, viewport: desktop, components: [], derivation: d}]}, accessibility: [], responsive: [], assets: [], observations: [], gaps: []}\n',
  });
  assert.equal(good.length, 0, good.join('\n'));
});

test('concept 11: a generation-carrying asset is refused outside work/ui-screen@1, with a dedicated message for work/implementation@1', () => {
  const onImplementation = refusalsFor({
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: r\nowners: [{role: module, path: a.ts}]\nassets: [{path: assets/running.png, generation: {tool: image_gen.imagegen, promptPath: p, inputRefs: []}}]\n',
  });
  assert.ok(onImplementation.some(p => p.includes('implementation captures are real running-page screenshots')), onImplementation.join('\n'));

  const onOtherFamily = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement@1\nid: fr.f.x\ntitle: t\nstate: todo\nassets: [{path: assets/a.png, generation: {tool: image_gen.imagegen, promptPath: p, inputRefs: []}}]\n',
  });
  assert.ok(onOtherFamily.some(p => p.includes('a generated direction asset is ui-owned only')), onOtherFamily.join('\n'));
});

test('concept 12: a done uat-flow needs a sibling evidence.yaml naming a run with screens, videos and a passing result.md', () => {
  const noEvidence = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.x\ntitle: t\nstate: done\n',
  });
  assert.ok(noEvidence.some(p => p.includes('no sibling evidence.yaml naming the run')), noEvidence.join('\n'));

  const workRoot = tree({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.x\ntitle: t\nstate: done\n',
    'features/f/uat/x/evidence.yaml': 'schema: work/evidence@1\nrecord: uat.f.x\noutcome: pass\nrun: runs/run-1\n',
  });
  const missingRunFolder = [];
  checkWorkTree(workRoot, missingRunFolder);
  assert.ok(missingRunFolder.some(p => p.includes('has no screens/')), missingRunFolder.join('\n'));
  assert.ok(missingRunFolder.some(p => p.includes('has no videos/')), missingRunFolder.join('\n'));
  assert.ok(missingRunFolder.some(p => p.includes('has no result.md')), missingRunFolder.join('\n'));

  write(workRoot, 'features/f/uat/x/runs/run-1/screens/step-1.png', 'x');
  write(workRoot, 'features/f/uat/x/runs/run-1/videos/walk.webm', 'x');
  write(workRoot, 'features/f/uat/x/runs/run-1/result.md', 'outcome: fail\n');
  const failingOutcome = [];
  checkWorkTree(workRoot, failingOutcome);
  assert.ok(failingOutcome.some(p => p.includes('does not record outcome: pass')), failingOutcome.join('\n'));

  write(workRoot, 'features/f/uat/x/runs/run-1/result.md', 'outcome: pass\n');
  const passing = [];
  checkWorkTree(workRoot, passing);
  assert.equal(passing.length, 0, passing.join('\n'));
});

test('concept 6: schemas/work-layout.yaml\'s shape.families must equal check-example-work.mjs\'s own FAMILIES set (FAMILIES_DRIFT)', () => {
  const dir = freshDir();

  const missingFile = path.join(dir, 'missing-work-layout.yaml');
  const problemsMissingFile = [];
  checkFamiliesDrift(problemsMissingFile, missingFile);
  assert.ok(problemsMissingFile.some(p => p.includes('FAMILIES_DRIFT')), problemsMissingFile.join('\n'));

  const noFamilies = path.join(dir, 'no-families.yaml');
  write(dir, 'no-families.yaml', 'shape:\n  workspace: workspace.yaml\n');
  const problemsNoFamilies = [];
  checkFamiliesDrift(problemsNoFamilies, noFamilies);
  assert.ok(problemsNoFamilies.some(p => p.includes('shape.families is missing')), problemsNoFamilies.join('\n'));

  const wrongFamilies = path.join(dir, 'wrong-families.yaml');
  write(dir, 'wrong-families.yaml', 'shape:\n  families: [business, architecture]\n');
  const problemsWrong = [];
  checkFamiliesDrift(problemsWrong, wrongFamilies);
  assert.ok(problemsWrong.some(p => p.includes('FAMILIES_DRIFT') && p.includes('missing') && p.includes('extra')), problemsWrong.join('\n'));

  const rightFamilies = path.join(dir, 'right-families.yaml');
  write(dir, 'right-families.yaml', `shape:\n  families: [${[...FAMILIES].join(', ')}]\n`);
  const problemsRight = [];
  checkFamiliesDrift(problemsRight, rightFamilies);
  assert.equal(problemsRight.length, 0, problemsRight.join('\n'));
});

test('concept 13: _resources custody is exactly the work/resource@1 schema, and a uat-flow\'s environment/fixtures/accounts refs resolve to the right kind', () => {
  const wrongSchema = refusalsFor({
    '_resources/environments/dev/resource.yaml': 'schema: work/resource@2\nid: environment.f.dev\nkind: environment\nowner: o\nrevision: r\ndetails: {}\n',
  });
  assert.ok(wrongSchema.some(p => p.includes('uses schema work/resource@1, not "work/resource@2"')), wrongSchema.join('\n'));

  const badEnvRef = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.x\ntitle: t\nstate: todo\nenvironment: environment.f.ghost\n',
  });
  assert.ok(badEnvRef.some(p => p.includes('environment environment.f.ghost does not resolve')), badEnvRef.join('\n'));

  const wrongKind = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.x\ntitle: t\nstate: todo\nenvironment: fixture.f.seed\n',
    '_resources/fixtures/seed/resource.yaml': 'schema: work/resource@1\nid: fixture.f.seed\nkind: fixture\nowner: o\nrevision: r\ndetails: {}\n',
  });
  assert.ok(wrongKind.some(p => p.includes('resolves to a work/resource@1 of kind "fixture", not environment')), wrongKind.join('\n'));

  const badIdentity = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.x\ntitle: t\nstate: todo\naccounts: accounts.yaml\n',
    'features/f/uat/x/accounts.yaml': 'schema: work/disposable-accounts@1\naccounts: [{role: person, identity: identity.f.ghost}]\n',
  });
  assert.ok(badIdentity.some(p => p.includes('accounts.yaml identity identity.f.ghost does not resolve')), badIdentity.join('\n'));

  const good = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.x\ntitle: t\nstate: todo\nenvironment: environment.f.dev\nfixtures: [fixture.f.seed]\naccounts: accounts.yaml\n',
    'features/f/uat/x/accounts.yaml': 'schema: work/disposable-accounts@1\naccounts: [{role: person, identity: identity.f.demo}]\n',
    '_resources/environments/dev/resource.yaml': 'schema: work/resource@1\nid: environment.f.dev\nkind: environment\nowner: o\nrevision: r\ndetails: {}\n',
    '_resources/fixtures/seed/resource.yaml': 'schema: work/resource@1\nid: fixture.f.seed\nkind: fixture\nowner: o\nrevision: r\ndetails: {}\n',
    '_resources/identities/demo/resource.yaml': 'schema: work/resource@1\nid: identity.f.demo\nkind: identity\nowner: o\nrevision: r\ndetails: {}\n',
  });
  assert.equal(good.length, 0, good.join('\n'));
});

test('payload rule: a yaml whose schema is not a work/* record schema is an artifact payload - INFO PAYLOAD_SKIPPED, never id-matched to its path, never ref-collected', () => {
  // A tool receipt inside a family path: no id, foreign schema. Before the rule this drew
  // "id is undefined, but its place says ..."; now it is counted as a skipped payload.
  const workRoot = tree({
    'features/f/ui/screen/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.screen\ntitle: t\nstate: todo\n',
    'features/f/ui/screen/assets/generation-receipts.yaml': 'schema: starci/generation-receipts@1\ntool: image_gen.imagegen\ncalls: []\n',
  });
  const problems = [];
  const infos = [];
  checkWorkTree(workRoot, problems, [], infos);
  assert.equal(problems.length, 0, problems.join('\n'));
  assert.ok(infos.some(i => i.includes('PAYLOAD_SKIPPED') && i.includes('generation-receipts.yaml')), infos.join('\n'));

  // A run manifest's own id registers no record, and record-shaped ids inside it (assertions,
  // nodeId) are the tool's output - not edges. A dangling-looking id inside a payload cannot refuse.
  const workRoot2 = tree({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.x\ntitle: t\nstate: todo\n',
    'features/f/uat/x/runs/run-1/manifest.yaml': 'schema: starci/uat-run-manifest@1\nid: uat.f.x.runs.run-1\nnodeId: uat.f.x\nassertions:\n  - {id: br.f.ghost, expected: yes, observed: not-run}\n',
  });
  const problems2 = [];
  checkWorkTree(workRoot2, problems2);
  assert.equal(problems2.length, 0, problems2.join('\n'));

  // ...while the same dangling id authored on a real record still refuses - the payload skip
  // narrows the walk, not the ref check itself.
  const stillChecked = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.x\ntitle: t\nstate: todo\nproves: [br.f.ghost]\n',
  });
  assert.ok(stillChecked.some(p => p.includes('br.f.ghost, which no record owns')), stillChecked.join('\n'));

  // A yaml carrying NO schema line is not payload: it stays on the record path and the
  // id-matches-path rule still sees it.
  const schemaLess = refusalsFor({
    'features/f/ui/screen/assets/loose.yaml': 'note: no schema declared\n',
  });
  assert.ok(schemaLess.some(p => p.includes('id is undefined, but its place says ui.f.screen.assets')), schemaLess.join('\n'));
});

// ---------- v11 compact format: inlined acceptance criteria ----------

test('v11 compact: `parent#frag` resolves an inlined criterion by short name, last id segment, and full former ac id', () => {
  const workRoot = tree({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.rule.works-when, name: works-when, text: "it works"}\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: todo\nrefs: [br.f.rule#works-when, br.f.rule#ac.f.rule.works-when]\n',
  });
  const problems = [];
  const warnings = [];
  checkWorkTree(workRoot, problems, warnings);
  assert.equal(problems.length, 0, problems.join('\n'));
  assert.equal(warnings.length, 0, warnings.join('\n'));

  // a fragment no criterion of the parent carries is refused
  const badFrag = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.rule.works-when, name: works-when}\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: todo\nrefs: [br.f.rule#nothing-here]\n',
  });
  assert.ok(badFrag.some(p => p.includes('br.f.rule#nothing-here') && p.includes('names no criterion')), badFrag.join('\n'));

  // a fragment on a parent that is not a record is refused
  const badParent = refusalsFor({
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: todo\nrefs: [br.f.ghost#works-when]\n',
  });
  assert.ok(badParent.some(p => p.includes('br.f.ghost#works-when') && p.includes('no record owns br.f.ghost')), badParent.join('\n'));

  // and the truncated `something#` form is refused, not silently ignored
  const malformed = refusalsFor({
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: todo\nrefs: [br.f.rule#]\n',
  });
  assert.ok(malformed.some(p => p.includes('REF_MALFORMED')), malformed.join('\n'));
});

test('v11 compact: a bare collapsed ac id still resolves through the parent, but warns AC_UNREMAPPED_REF; the entry\'s own declaration never warns', () => {
  const workRoot = tree({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.rule.works-when, name: works-when}\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: todo\nrefs: [ac.f.rule.works-when]\n',
  });
  const problems = [];
  const warnings = [];
  checkWorkTree(workRoot, problems, warnings);
  assert.equal(problems.length, 0, problems.join('\n'));
  const remapped = warnings.filter(w => w.includes('AC_UNREMAPPED_REF'));
  assert.equal(remapped.length, 1, warnings.join('\n')); // only br.f.other's ref warns
  assert.ok(remapped[0].includes('br/other/index.yaml'), remapped[0]);
  assert.ok(remapped[0].includes('br.f.rule#ac.f.rule.works-when'), remapped[0]);
});

test('v11 compact: an inline criterion id must be the id its place implies, may not collide, and may not carry its own lifecycle', () => {
  // wrong prefix - the compact form keeps the former record's own id
  const mismatch = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.elsewhere.works-when, name: works-when}\n',
  });
  assert.ok(mismatch.some(p => p.includes('AC_ID_MISMATCH')), mismatch.join('\n'));

  // an inline id that a live record already owns
  const liveCollision = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.rule.kept, name: kept}\n',
    'features/f/br/rule/ac/kept/index.yaml': 'schema: work/acceptance-criterion@1\nid: ac.f.rule.kept\ntitle: t\nrule: br.f.rule\n',
  });
  assert.ok(liveCollision.some(p => p.includes('AC_ID_COLLISION')), liveCollision.join('\n'));

  // the same inline id claimed under two parents
  const dualClaim = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule@1\nid: br.f.a\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.a.dup, name: dup}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule@1\nid: br.f.b\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.a.dup, name: dup}\n',
  });
  assert.ok(dualClaim.some(p => p.includes('AC_ID_COLLISION') && p.includes('br.f.a') && p.includes('br.f.b')), dualClaim.join('\n'));

  // an entry carrying state/evidence/change is lifecycle content smuggled inline - it belongs in its own ac record
  const lifecycle = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.rule.tracked, name: tracked, state: todo}\n',
  });
  assert.ok(lifecycle.some(p => p.includes('AC_LIFECYCLE_INLINE')), lifecycle.join('\n'));
});

test('v11 compact: structured ref fields (blockedBy.record, closedBy, appliesTo) resolve `parent#frag` and collapsed ac ids to the carrying record', () => {
  // a blockedBy on one criterion of a record is a wait on that record - resolves, no dangling refusal
  const blocked = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nacceptance:\n  - {id: ac.f.rule.works-when, name: works-when}\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: todo\nblockedBy:\n  - {record: "br.f.rule#works-when", because: "waiting on that criterion"}\n',
  });
  assert.equal(blocked.filter(p => p.includes('does not exist')).length, 0, blocked.join('\n'));

  // closedBy naming a collapsed criterion's old id still finds the record that owns it
  const gapClosed = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: done\nacceptance:\n  - {id: ac.f.rule.works-when, name: works-when}\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/gap/absence/index.yaml': 'schema: work/gap@1\nid: gap.f.absence\ntitle: t\nstate: done\nstatement: s\nclosedBy: ac.f.rule.works-when\nverificationSource: authored-claim\nbecause: closed\n',
  });
  assert.equal(gapClosed.filter(p => p.includes('no record owns') || p.includes('closedBy')).length, 0, gapClosed.join('\n'));
});

test('v11 compact: a kept-separate ac record still resolves as itself, and `parent#ac-id` reaches it through the parent', () => {
  const workRoot = tree({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule@1\nid: br.f.rule\ntitle: t\nstate: todo\nacceptanceCriteria: [has-own]\n',
    'features/f/br/rule/ac/has-own/index.yaml': 'schema: work/acceptance-criterion@1\nid: ac.f.rule.has-own\ntitle: t\nrule: br.f.rule\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule@1\nid: br.f.other\ntitle: t\nstate: todo\nrefs: [br.f.rule#ac.f.rule.has-own, ac.f.rule.has-own]\n',
  });
  const problems = [];
  const warnings = [];
  checkWorkTree(workRoot, problems, warnings);
  assert.equal(problems.length, 0, problems.join('\n'));
  // the kept ac is still a live record, so the bare id is a normal ref - no remap warning
  assert.equal(warnings.filter(w => w.includes('AC_UNREMAPPED_REF')).length, 0, warnings.join('\n'));
});
