import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha256} from '../../engine/digest.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {entrySkillsPlan, applyEntrySkillsPlan, bootstrapPlan, payloadFiles} from '../../scripts/install/install.mjs';

const source = path.resolve(import.meta.dirname, '..', '..');
const digest = body => sha256(String(body).replace(/\r\n/g, '\n'));
const write = (repo, relative, body) => {
  const file = path.join(repo, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, body);
  return file;
};
const fixture = t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-entry-'));
  t.after(() => {
    const resolved = path.resolve(repo);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('starci-entry-'));
    fs.rmSync(resolved, {recursive: true, force: true});
  });
  return repo;
};
const oldSkill = '# Prior installer-owned entry\n';
// Assembled because live source cannot retain a registered retired public path.
const retiredEntry = ['skills', 'define-goal', 'SKILL.md'].join('/');
const retiredProjection = '.agents/' + retiredEntry;
const oldManifest = {files: {[retiredEntry]: digest(oldSkill)}};

test('the manifest ships UI source while cache, secret and test-capture paths remain excluded', t => {
  const repo = fixture(t);
  const files = ['ui/server.mjs', 'ui/package.json', 'ui/package-lock.json', 'ui/src/icon.png',
    'ui/node_modules/local/private.mjs', 'ui/dist/app.js', 'ui/.secrets/token',
    'ui/.git-starci-status-backup/data', 'ui/agent-log-preview.png', 'ui/debug.log'];
  for (const file of files) write(repo, file, 'fixture bytes');
  assert.deepEqual(payloadFiles(repo), ['ui/package-lock.json', 'ui/package.json', 'ui/server.mjs', 'ui/src/icon.png']);
});

test('fresh shared and Devin discovery copies match payload bytes and explicit-selection policies', t => {
  const repo = fixture(t);
  fs.mkdirSync(path.join(repo, '.devin/skills'), {recursive: true});
  const custody = applyEntrySkillsPlan(entrySkillsPlan(repo), () => {});
  assert.equal(custody.hashMode, 'sha256-bytes');
  assert.ok(Object.keys(custody.files).length > 0);
  for (const [relative, expected] of Object.entries(custody.files)) {
    const sourceRelative = relative.replace(/^\.(agents|devin)\/skills\//, 'skills/');
    const actual = fs.readFileSync(path.join(repo, relative));
    assert.deepEqual(actual, fs.readFileSync(path.join(source, sourceRelative)), relative);
    assert.equal(sha256(actual), expected);
  }
  for (const root of ['.agents/skills', '.devin/skills']) {
    assert.deepEqual(fs.readdirSync(path.join(repo, root)), ['starci']);
    const front = fs.readFileSync(path.join(repo, root, 'starci/SKILL.md'), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
    const metadata = parseYaml(front);
    assert.equal(metadata['disable-model-invocation'], true);
    assert.deepEqual(metadata.triggers, ['user']);
    const policy = parseYaml(fs.readFileSync(path.join(repo, root, 'starci/agents/openai.yaml'), 'utf8'));
    assert.equal(policy.policy.allow_implicit_invocation, false);
  }
});

test('exact old copies retire while unrelated discovery entries remain', t => {
  const repo = fixture(t);
  write(repo, retiredProjection, oldSkill);
  write(repo, '.agents/skills/unrelated/SKILL.md', '# Unrelated user tool\n');
  const plan = entrySkillsPlan(repo, oldManifest);
  assert.deepEqual(plan.remove.map(item => item.relative), [retiredProjection]);
  applyEntrySkillsPlan(plan, () => {});
  assert.equal(fs.existsSync(path.join(repo, '.agents/skills/define-goal')), false);
  assert.equal(fs.readFileSync(path.join(repo, '.agents/skills/unrelated/SKILL.md'), 'utf8'), '# Unrelated user tool\n');
});

test('keptLocal retired copies remain even when their recorded hash or new internal body matches', t => {
  const internalBody = fs.readFileSync(path.join(source, 'skills/starci/references/define-goal.md'));
  for (const body of ['# Owner-kept prior entry\n', internalBody]) {
    const repo = fixture(t);
    write(repo, retiredProjection, body);
    const manifest = {files: {[retiredEntry]: digest(body)}, keptLocal: [retiredEntry]};
    const plan = entrySkillsPlan(repo, manifest);
    assert.deepEqual(plan.remove, []);
    assert.ok(plan.preserved.some(item => item.path === '.agents/skills/define-goal' && item.reason.includes('keptLocal')));
    applyEntrySkillsPlan(plan, () => {});
    assert.deepEqual(fs.readFileSync(path.join(repo, retiredProjection)), Buffer.from(body));
  }
});

test('keptLocal current entries are held even when bytes match new payload or prior custody hashes', t => {
  const currentPath = '.agents/skills/starci/SKILL.md';
  const runtimePath = 'skills/starci/SKILL.md';
  const canonical = fs.readFileSync(path.join(source, runtimePath));
  for (const body of ['# Owner-kept current entry\n', canonical]) {
    const repo = fixture(t);
    write(repo, currentPath, body);
    const manifest = {files: {[runtimePath]: digest(body)}, keptLocal: [runtimePath],
      hostSkills: {hashMode: 'sha256-bytes', files: {[currentPath]: sha256(Buffer.from(body))}}};
    const plan = entrySkillsPlan(repo, manifest);
    assert.deepEqual(plan.write, []);
    assert.deepEqual(plan.files, {}, 'owner-kept files are not adopted into new installer custody');
    assert.ok(plan.preserved.some(item => item.path === '.agents/skills/starci' && item.reason.includes('keptLocal')));
    applyEntrySkillsPlan(plan, () => {});
    assert.deepEqual(fs.readFileSync(path.join(repo, currentPath)), Buffer.from(body));
    assert.equal(fs.existsSync(path.join(repo, '.agents/skills/starci/agents')), false);
  }
});

test('modified or extra old entry files preserve the whole unproven directory', t => {
  for (const extra of [false, true]) {
    const repo = fixture(t), body = extra ? oldSkill : '# Owner changed this entry\n';
    write(repo, retiredProjection, body);
    if (extra) write(repo, '.agents/skills/define-goal/private.md', 'owner data');
    const plan = entrySkillsPlan(repo, oldManifest);
    assert.deepEqual(plan.remove, []);
    assert.equal(plan.preserved[0].path, '.agents/skills/define-goal');
    applyEntrySkillsPlan(plan, () => {});
    assert.equal(fs.readFileSync(path.join(repo, retiredProjection), 'utf8'), body);
    if (extra) assert.equal(fs.readFileSync(path.join(repo, '.agents/skills/define-goal/private.md'), 'utf8'), 'owner data');
  }
});

test('new entry modifications cannot be overwritten by old recorded hashes', t => {
  const repo = fixture(t), previous = '# Earlier canonical starci\n', actual = '# Owner-edited starci\n';
  write(repo, '.agents/skills/starci/SKILL.md', actual);
  const plan = entrySkillsPlan(repo, {files: {'skills/starci/SKILL.md': digest(previous)}});
  assert.deepEqual(plan.write, []);
  assert.equal(plan.preserved[0].path, '.agents/skills/starci');
  applyEntrySkillsPlan(plan, () => {});
  assert.equal(fs.readFileSync(path.join(repo, '.agents/skills/starci/SKILL.md'), 'utf8'), actual);
});

test('known prior host custody permits update and records the new hashes', t => {
  const repo = fixture(t), previous = '# Earlier canonical starci\n';
  write(repo, '.agents/skills/starci/SKILL.md', previous);
  const plan = entrySkillsPlan(repo, {hostSkills: {files: {'.agents/skills/starci/SKILL.md': digest(previous)}}});
  const custody = applyEntrySkillsPlan(plan, () => {});
  const expected = fs.readFileSync(path.join(source, 'skills/starci/SKILL.md'));
  assert.deepEqual(fs.readFileSync(path.join(repo, '.agents/skills/starci/SKILL.md')), expected);
  assert.equal(custody.files['.agents/skills/starci/SKILL.md'], digest(expected));
});

test('a cleanup file changed after planning refuses before removal or discovery writes', t => {
  const repo = fixture(t), file = write(repo, retiredProjection, oldSkill);
  const plan = entrySkillsPlan(repo, oldManifest);
  fs.writeFileSync(file, '# Changed after inspection\n');
  assert.throws(() => applyEntrySkillsPlan(plan, () => {}), /changed after cleanup planning/);
  assert.equal(fs.readFileSync(file, 'utf8'), '# Changed after inspection\n');
  assert.equal(fs.existsSync(path.join(repo, '.agents/skills/starci')), false);
});

test('line-ending drift with prior normalized custody is copied to exact canonical bytes', t => {
  const repo = fixture(t);
  const canonical = fs.readFileSync(path.join(source, 'skills/starci/SKILL.md'));
  const crlf = canonical.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  write(repo, '.agents/skills/starci/SKILL.md', crlf);
  const plan = entrySkillsPlan(repo, {files: {'skills/starci/SKILL.md': digest(crlf)}});
  assert.ok(plan.write.some(item => item.relative === '.agents/skills/starci/SKILL.md'));
  const custody = applyEntrySkillsPlan(plan, () => {});
  assert.deepEqual(fs.readFileSync(path.join(repo, '.agents/skills/starci/SKILL.md')), canonical);
  assert.equal(custody.files['.agents/skills/starci/SKILL.md'], sha256(canonical));
});

test('a destination appearing after planning refuses instead of overwriting it', t => {
  const repo = fixture(t), plan = entrySkillsPlan(repo), first = plan.write[0];
  write(repo, first.relative, 'late owner file');
  assert.throws(() => applyEntrySkillsPlan(plan, () => {}), /changed after copy planning/);
  assert.equal(fs.readFileSync(path.join(repo, first.relative), 'utf8'), 'late owner file');
});

test('a junction or symlink discovery root is not followed or assigned installer custody', t => {
  const repo = fixture(t), outside = fixture(t);
  write(outside, 'sentinel', 'external owner');
  fs.mkdirSync(path.join(repo, '.agents'));
  fs.symlinkSync(outside, path.join(repo, '.agents/skills'), process.platform === 'win32' ? 'junction' : 'dir');
  const plan = entrySkillsPlan(repo, oldManifest);
  assert.equal(plan.skipped[0].dir, '.agents/skills');
  assert.deepEqual(plan.write, []);
  assert.deepEqual(plan.remove, []);
  applyEntrySkillsPlan(plan, () => {});
  assert.deepEqual(fs.readdirSync(outside), ['sentinel']);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel'), 'utf8'), 'external owner');
});

test('bootstrap preview replaces only the exact prior block and preserves custom host instructions', t => {
  const repo = fixture(t);
  const old = '# Prior bootstrap\n<!-- starci:prompt-entry -->\nPrior owned runtime entry.\n<!-- /starci:prompt-entry -->\n';
  write(repo, '.claude/init/AGENTS.md', old);
  const original = '# Host instructions\n\n' + old + '\nKeep this custom instruction.\n';
  write(repo, 'AGENTS.md', original);
  const plan = bootstrapPlan(repo, {hosts: []}, {files: {'init/AGENTS.md': digest(old)}});
  assert.equal(plan[0].action, 'updated');
  assert.ok(plan[0].text.includes('# Host instructions'));
  assert.ok(plan[0].text.includes('Keep this custom instruction.'));
  const canonical = fs.readFileSync(path.join(source, 'init/AGENTS.md'), 'utf8').match(/<!-- starci:prompt-entry -->[\s\S]*?<!-- \/starci:prompt-entry -->/)[0];
  assert.ok(plan[0].text.includes(canonical));
  assert.equal(fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'), original, 'planning has no effects');
});

test('an edited or unknown bootstrap block refuses without modifying host text', t => {
  const repo = fixture(t);
  const old = '<!-- starci:prompt-entry -->\nPrior owned runtime entry.\n<!-- /starci:prompt-entry -->\n';
  write(repo, '.claude/init/AGENTS.md', old);
  const current = old.replace('Prior owned', 'Owner modified');
  write(repo, 'AGENTS.md', current);
  assert.throws(() => bootstrapPlan(repo, {hosts: []}, {files: {'init/AGENTS.md': digest(old)}}), /did not write/);
  assert.equal(fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'), current);
});
