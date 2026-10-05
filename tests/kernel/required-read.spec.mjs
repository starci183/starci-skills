import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withKernelIngress } from '../helpers/kernel-ingress-fixture.mjs';
import { kernelAuthorityOf } from '../../scripts/kernel/verbs/shared/kernel-seat.mjs';
import { kernelReadManifest, verifyKernelRead, requireKernelRead } from '../../scripts/kernel/required-read.mjs';
import { callerAdmission } from '../../scripts/kernel/caller-admission.mjs';
import ackRev from '../../scripts/kernel/verbs/kernel-ack-rev.mjs';
import { ENGINE_SCHEMA } from '../../engine/constants.mjs';
import { INSTALL_MANIFEST_FILE, INSTALL_PROTOCOL_SCHEMA, installedPayloadDigest } from '../../scripts/lib/install-custody.mjs';

const options = w => ({ root: w.runtime,authority: kernelAuthorityOf(w.ledger.db,w.workflowId,w.handle),ops: ['review.verify'] });
const ack = (w,manifest) => w.ledger.transaction(() => w.ledger.appendEvent({ workflowId: w.workflowId,entityType: 'kernel',entityId: w.workflowId,kind: 'runtime-rev-acked',payload: { rev: manifest.rev,source: 'ack',readManifest: manifest } }));
const admitRead = w => requireKernelRead(w.ledger.db,w.workflowId,{ ...options(w),op: 'review.verify' });

test('required READ plan is complete and server-derived; exact attestation alone passes', t => withKernelIngress(t,w => {
  const required = kernelReadManifest(w.ledger.db,w.workflowId,options(w));
  assert.ok(required.files.some(row => row.path === 'modules/kernel/api.yaml'));
  assert.ok(required.files.some(row => row.path === 'modules/ops/ops/review.verify.yaml'));
  assert.ok(required.files.every(row => row.bytes > 0 && /^[a-f0-9]{64}$/.test(row.sha256)));
  verifyKernelRead(structuredClone(required),required);
  for (const tamper of [m => m.files.pop(),m => m.files.push({ path: 'README.md',sha256: '0'.repeat(64),bytes: 1 }),m => { m.files[0].sha256='0'.repeat(64); },m => { m.incarnation='another'; },m => { m.ops=[]; }]) {
    const wrong=structuredClone(required);tamper(wrong);assert.throws(() => verifyKernelRead(wrong,required),{ code: 'kernel-read-unverified' });
  }
  assert.throws(() => admitRead(w),{ code: 'kernel-read-unverified' });ack(w,required);admitRead(w);
}));

test('boot provenance and legacy empty READ do not acknowledge current bytes; replaced incarnation owes its own read', t => withKernelIngress(t,w => {
  for (const [kind,payload] of [['runtime-read-delivered',{ rev: w.git('rev-parse','HEAD'),files: ['modules/kernel/kernel-prompt.md'],source: 'boot' }],['runtime-rev-acked',{ rev: w.git('rev-parse','HEAD'),files: [],source: 'ack' }]])
    w.ledger.transaction(() => w.ledger.appendEvent({ workflowId: w.workflowId,entityType: 'kernel',entityId: w.workflowId,kind,payload }));
  assert.throws(() => admitRead(w),{ code: 'kernel-read-unverified' });
  ack(w,kernelReadManifest(w.ledger.db,w.workflowId,options(w)));admitRead(w);
  w.ledger.transaction(() => w.ledger.db.prepare("UPDATE signals SET token='replacement' WHERE scope='kernel' AND key=?").run(w.workflowId));
  assert.throws(() => admitRead(w),{ code: 'kernel-read-unverified' });
}));

test('dirty relevant bytes at unchanged HEAD and failed read status refuse; unrelated documentation commit preserves scoped read', t => withKernelIngress(t,w => {
  const required=kernelReadManifest(w.ledger.db,w.workflowId,options(w));ack(w,required);
  w.write('modules/kernel/kernel-prompt.md','dirty prompt');assert.equal(w.git('rev-parse','HEAD'),required.rev);
  assert.throws(() => admitRead(w),{ code: 'kernel-read-unverified' });w.git('checkout','--','modules/kernel/kernel-prompt.md');
  assert.throws(() => kernelReadManifest(w.ledger.db,w.workflowId,{ ...options(w),status: () => ({ status: null,signal: 'SIGTERM',stdout: '' }) }),{ code: 'kernel-read-unverified' });
  w.write('README.md','unrelated documentation');w.git('add','README.md');w.git('commit','-qm','docs');admitRead(w);
  fs.rmSync(path.join(w.runtime,'modules/kernel/driver-loop.yaml'));assert.throws(() => admitRead(w),{ code: 'kernel-read-unverified' });
}));

test('large current read set has no lossy path cap; unknown deployed revision is a visible refusal', t => withKernelIngress(t,w => {
  for(let i=0;i<18;i++)w.write(`modules/cli/commands/kernel/extra-${i}.yaml`,`verb: fixture-${i}`);
  w.git('add','-A');w.git('commit','-qm','large complete set');
  const required=kernelReadManifest(w.ledger.db,w.workflowId,options(w));assert.ok(required.files.length>18);verifyKernelRead(required,required);ack(w,required);admitRead(w);
  const head=fs.readFileSync(path.join(w.runtime,'.git/HEAD'));fs.writeFileSync(path.join(w.runtime,'.git/HEAD'),'not a revision');
  try { assert.throws(() => kernelReadManifest(w.ledger.db,w.workflowId,options(w)),{ code: 'kernel-read-unverified' }); }
  finally { fs.writeFileSync(path.join(w.runtime,'.git/HEAD'),head); }
}));

test('actual ack verb keeps owner plan separate, refuses owner acknowledgement, and retains events on invalid manifests', t => withKernelIngress(t,w => {
  const saved=process.env.STARCI_KERNEL_REV_ROOT;process.env.STARCI_KERNEL_REV_ROOT=w.runtime;
  try {
    const required=kernelReadManifest(w.ledger.db,w.workflowId,options(w));const file=path.join(w.root,'read.json');fs.writeFileSync(file,JSON.stringify(required));
    let projected;
    ackRev.run({ ledger: w.ledger,args: { workflow: w.workflowId,plan: true,op: 'review.verify',json: true },caller: { role: 'owner' },emit: result => { projected=result; } });assert.deepEqual(projected.readManifest,required);
    const args={ workflow: w.workflowId,rev: required.rev,'read-manifest': file,op: 'review.verify' };
    assert.throws(() => ackRev.run({ ledger: w.ledger,args,caller: { role: 'owner',handle: w.handle },emit() {} }),{ code: 'kernel-caller-stale' });
    const admitted=callerAdmission(w.ledger,args,{ env: { ...process.env,ORCA_TERMINAL_HANDLE: w.handle },root: w.runtime });
    admitted.run(() => ackRev.run({ ledger: w.ledger,args,caller: admitted.caller,emit() {} }));admitRead(w);
    const count=w.ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='runtime-rev-acked'").get().n;
    const bad=structuredClone(required);bad.files.pop();fs.writeFileSync(file,JSON.stringify(bad));
    assert.throws(() => admitted.run(() => ackRev.run({ ledger: w.ledger,args,caller: admitted.caller,emit() {} })),{ code: 'kernel-read-unverified' });
    assert.equal(w.ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='runtime-rev-acked'").get().n,count);
  } finally { if(saved===undefined)delete process.env.STARCI_KERNEL_REV_ROOT;else process.env.STARCI_KERNEL_REV_ROOT=saved; }
}));

test('normal installed no-Git runtime requires actual descriptor custody and exact current bytes, never version alone', t => withKernelIngress(t,w => {
  fs.renameSync(path.join(w.runtime,'.git'),path.join(w.root,'retained-git'));
  w.write('package.json',JSON.stringify({ name: 'starci-installed-fixture',version: '0.0.1-fixture' }));
  w.write('engine/constants.mjs',`export const ENGINE_SCHEMA=${JSON.stringify(ENGINE_SCHEMA)};`);
  const files={};
  const scan=(dir,relative='') => { for(const entry of fs.readdirSync(dir,{ withFileTypes: true })) {
    const rel=relative ? `${relative}/${entry.name}` : entry.name;
    if(entry.isDirectory())scan(path.join(dir,entry.name),rel);else files[rel]=installedPayloadDigest(fs.readFileSync(path.join(dir,entry.name)));
  } };scan(w.runtime);
  const custody={ name: 'starci-installed-fixture',version: '0.0.1-fixture',installProtocol: { schema: INSTALL_PROTOCOL_SCHEMA,engine: ENGINE_SCHEMA },files };
  const descriptor=path.join(w.runtime,INSTALL_MANIFEST_FILE);
  assert.throws(() => kernelReadManifest(w.ledger.db,w.workflowId,options(w)),{ code: 'kernel-read-unverified' });
  fs.writeFileSync(descriptor,JSON.stringify(custody));
  const required=kernelReadManifest(w.ledger.db,w.workflowId,options(w));assert.equal(required.revision.kind,'installed');assert.match(required.rev,/^installed:[a-f0-9]{64}$/);
  verifyKernelRead(required,required);
  const saved=process.env.STARCI_KERNEL_REV_ROOT;process.env.STARCI_KERNEL_REV_ROOT=w.runtime;
  const attest=manifest => {
    const file=path.join(w.root,'installed-read.json');fs.writeFileSync(file,JSON.stringify(manifest));
    const args={ workflow: w.workflowId,rev: manifest.rev,'read-manifest': file,op: 'review.verify' };
    const admitted=callerAdmission(w.ledger,args,{ env: { ...process.env,ORCA_TERMINAL_HANDLE: w.handle },root: w.runtime });
    admitted.run(() => ackRev.run({ ledger: w.ledger,args,caller: admitted.caller,emit() {} }));
  };
  try {
  attest(required);admitRead(w);
  w.write('modules/kernel/kernel-prompt.md','changed actual installed bytes');
  assert.throws(() => admitRead(w),{ code: 'kernel-read-unverified' });
  const forged={ ...custody,files: { ...files,'modules/kernel/kernel-prompt.md': '0'.repeat(64) } };fs.writeFileSync(descriptor,JSON.stringify(forged));
  assert.throws(() => admitRead(w),{ code: 'kernel-read-unverified' });
  custody.files['modules/kernel/kernel-prompt.md']=installedPayloadDigest(fs.readFileSync(path.join(w.runtime,'modules/kernel/kernel-prompt.md')));fs.writeFileSync(descriptor,JSON.stringify(custody));
  assert.throws(() => admitRead(w),{ code: 'kernel-read-unverified' },'old READ cannot cover modified bytes even with updated custody');
  attest(kernelReadManifest(w.ledger.db,w.workflowId,options(w)));admitRead(w);
  } finally { if(saved===undefined)delete process.env.STARCI_KERNEL_REV_ROOT;else process.env.STARCI_KERNEL_REV_ROOT=saved; }
}));
