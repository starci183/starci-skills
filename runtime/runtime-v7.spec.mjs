import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadRuntimeConfig } from './config.mjs';
import { createReceipt, assertProgress } from './trace.mjs';
import { canonicalRoots, uatPair } from './topology.mjs';
import { validatorFor } from '../operators/validation.mjs';

const base = { receiptId:'receipt:r1', missionId:'m1', skillId:'starci-quality-assure', operatorId:'quality/lint', parentId:'call-parent', childId:'call-child', missionContext:{ project:'starci', objective:'assure' }, context:{ source:'be' }, input:{ exact:true }, expectedOutput:{ outcome:'pass' }, actualOutput:{ outcome:'pass' }, evidenceRefs:['git:abc'], sourceHeads:['git:abc'], transitionRule:{ outcome:'pass', target:'complete' }, resumeState:null, skip:null, error:null };

test('sole YAML config is strict v7 with debug initially enabled', () => assert.deepEqual(loadRuntimeConfig(), { version:'7.0.0', debug:true }));

test('debug true renders the normalized execution contract', () => {
  const receipt = createReceipt('CALL', base, { debug:true, now:()=> '2026-01-01T00:00:00.000Z' });
  for (const key of ['missionContext','context','input','expectedOutput','actualOutput','evidenceRefs','sourceHeads','transitionRule','resumeState','skip','error']) assert.ok(Object.hasOwn(receipt.trace,key), key);
});

test('debug false retains a typed receipt while reducing visibility', () => {
  const receipt = createReceipt('RETURN', { ...base, receiptId:'receipt:r2' }, { debug:false });
  assert.equal(receipt.type,'RETURN'); assert.ok(receipt.progressFingerprint); assert.deepEqual(Object.keys(receipt.trace).sort(), ['evidenceRefs','sourceHeads']);
});

test('secrets are redacted and chain-of-thought fields are omitted', () => {
  const receipt=createReceipt('ERROR',{...base,receiptId:'receipt:r3',input:{apiKey:'secret',nested:{password:'secret'}},missionContext:{chainOfThought:'never',objective:'safe'}},{debug:true});
  assert.equal(receipt.trace.input.apiKey,'[REDACTED]'); assert.equal(receipt.trace.input.nested.password,'[REDACTED]'); assert.equal(receipt.trace.missionContext.chainOfThought,undefined);
});

test('secrets embedded in headers, URLs, and generic strings are redacted', () => {
  const input={ note:'Authorization: Bearer abc.def', url:'https://user:pass@example.test/path?token=abc&safe=yes', header:'X-Api-Key: raw-secret' };
  const receipt=createReceipt('CALL',{...base,receiptId:'receipt:strings',input},{debug:true});
  const rendered=JSON.stringify(receipt.trace.input); assert.doesNotMatch(rendered,/abc\.def|user:pass|token=abc|raw-secret/); assert.match(rendered,/REDACTED/);
});

test('nested calls return and resume with parent-child identity', () => {
  const call=createReceipt('CALL',{...base,receiptId:'receipt:r4'},{debug:true});
  const ret=createReceipt('RETURN',{...base,receiptId:'receipt:r5',parentId:call.childId,childId:null},{debug:true});
  const resume=createReceipt('RESUME',{...base,receiptId:'receipt:r6',parentId:ret.parentId,resumeState:{from:'wait-1'}},{debug:true});
  assert.equal(ret.parentId,call.childId); assert.deepEqual(resume.trace.resumeState,{from:'wait-1'});
});

test('identical progress cycles are rejected', () => { const a=createReceipt('TRANSITION',{...base,receiptId:'receipt:r7'},{debug:false}); const b={...a,receiptId:'receipt:r8'}; assert.throws(()=>assertProgress([a,b]),/no-progress cycle/); });

test('topology is flat and excludes projects, coding-context, and Qdrant', () => {
  const roots=canonicalRoots(); assert.deepEqual(roots,['.worktrees/_templates','.worktrees/businesses','.worktrees/uat','.worktrees/sessions','.worktrees/debts']); assert.doesNotMatch(JSON.stringify(roots),/projects|coding-context|qdrant/i);
});

test('UAT snapshot and result form one canonical feature-flow pair', () => {
  assert.deepEqual(uatPair('.worktrees','authentication','sign-in'),{snapshot:'.worktrees/uat/authentication/sign-in/snapshot.json',result:'.worktrees/uat/authentication/sign-in/result.json'});
  const validateSnapshot=validatorFor(new URL('../templates/uat/snapshot.schema.json',import.meta.url));
  const template=JSON.parse(fs.readFileSync(new URL('../templates/uat/snapshot.template.json',import.meta.url))); assert.equal(validateSnapshot(template).valid,true);
});
