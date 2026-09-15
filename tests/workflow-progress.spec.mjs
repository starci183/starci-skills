import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgressReporter,progressLine} from '../kernel/progress.mjs';

test('kernel progress prints bounded decisions and transitions while deduplicating identical waits',()=>{
  const lines=[],report=createProgressReporter({enabled:true,write:value=>lines.push(value)});
  assert.equal(report({event:'manager-applied',actions:['dispatch:a'],rationale:'a unlocks the accepted dependency'}),true);
  assert.equal(report({event:'admission-deferred',op:'a',reason:'canonical writer busy'}),true);
  assert.equal(report({event:'admission-deferred',op:'a',reason:'canonical writer busy'}),false);
  assert.equal(report({event:'admission-deferred',op:'b',reason:'canonical writer busy'}),true);
  assert.equal(report({event:'admission-deferred',op:'a',reason:'canonical writer busy'}),false,'alternating waits do not spam');
  assert.equal(report({event:'launched',op:'a',runtime:'sol'}),true);
  assert.equal(report({event:'admission-deferred',op:'a',reason:'canonical writer busy'}),true);
  assert.match(lines.join(''),/manager: dispatch:a — a unlocks/);
  assert.match(lines.join(''),/waiting a: canonical writer busy/);
  assert.match(lines.join(''),/a: launched on sol/);
});

test('progress ignores poll noise and redacts capability-like values',()=>{
  assert.equal(progressLine({event:'tick',reason:'token=visible'}),null);
  const simple=progressLine({event:'op-blocked',op:'x',reason:'token=visible Bearer abc'});
  assert.match(simple,/token=\[redacted\]/);assert.doesNotMatch(simple,/visible|Bearer abc/);
  const line=progressLine({event:'op-blocked',op:'x',reason:'TELEGRAM_BOT_TOKEN="abc def"; ZALO_OA_SECRET: a secret with spaces, next'});
  assert.doesNotMatch(line,/abc def|a secret with spaces/);
  assert.match(line,/TELEGRAM_BOT_TOKEN=\[redacted\].*ZALO_OA_SECRET=\[redacted\]/);
  const json=progressLine({event:'op-blocked',reason:JSON.stringify({ZALO_OA_SECRET:'hidden value',PROVIDER_API_KEY:'private-key',RECOVERY_CUSTODY_ACCESS_KEY:'private-access'})});
  assert.doesNotMatch(json,/hidden value|private-key|private-access/);
});
