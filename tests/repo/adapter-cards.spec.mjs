import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const ADAPTERS=path.join(ROOT,'modules','models','agents');
// Agent differences are data. Every agent card must parse and start the one way, orchestration
// worker-start (Orca composes the command). The card is the
// Orca adapter card at top level plus an optional `capabilities:` key.
import {parseYaml} from '../../engine/yaml.mjs';

const cards=fs.readdirSync(ADAPTERS).filter(f=>f.endsWith('.yaml')).sort();
assert.ok(cards.length>0,'modules/models/agents holds no cards');

for(const file of cards){
  test(`agent card ${file} parses and starts through orchestration worker-start`,()=>{
    const card=parseYaml(fs.readFileSync(path.join(ADAPTERS,file),'utf8'));
    assert.ok(card&&typeof card==='object',`${file} did not parse to an object`);
    assert.equal(card.schema,'starci/agent-card@1',`${file} schema`);
    assert.equal(card.agent,path.basename(file,'.yaml'),`${file} agent name must equal the filename`);
    // Every agent is the one kind: Orca starts and supervises it (contract-changes/launch-through-worker-start.yaml).
    assert.equal(card.kind,'native-managed-agent',`${file} kind`);
    assert.equal(card.start?.api,'orchestration.worker-start',`${file}: every agent starts via orchestration.worker-start`);
    assert.equal(card.start?.agentArgument,card.agent,`${file}: worker-start --agent names the card's agent`);
    assert.ok(card.start?.modelArgument===undefined||typeof card.start.modelArgument==='boolean',`${file}: start.modelArgument is a boolean`);
    assert.equal(card.release?.api,'orchestration.worker-release',`${file}: a settled worker is released`);
    // worker-release alone does not end every agent (cursor-agent survived it): every card declares the runtime's close and its proof.
    assert.equal(card.release?.closeTerminal,true,`${file}: the released worker's terminal is closed by the runtime`);
    assert.equal(card.release?.verify,'terminal-process-tree',`${file}: the close is verified against the terminal's process tree`);
    for(const gone of ['terminalFallback','hostLaunchPrefix','commandPrefix','commandRequirements','kernelCommandRequirements','environmentStrip'])
      assert.equal(card[gone],undefined,`${file}: no hand-built launch command (${gone}) - Orca composes it`);
  });
}

// A card that attests its model on screen names it three times: model, modelMarker and the readiness
// identityPattern. A model bump that misses one silently mis-attests the worker.
test('an agent card that attests its model on screen names one model everywhere',()=>{
  for(const file of cards){
    const card=parseYaml(fs.readFileSync(path.join(ADAPTERS,file),'utf8'));
    if(card.modelMarker==null)continue;
    assert.equal(card.modelMarker,card.model,`${file}: modelMarker must equal model`);
    if(card.readiness?.identityPattern)assert.match(card.model,new RegExp(card.readiness.identityPattern),`${file}: readiness.identityPattern must match model`);
  }
});
