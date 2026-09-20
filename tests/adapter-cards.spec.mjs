import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve(import.meta.dirname,'..');
const ADAPTERS=path.join(ROOT,'modules','models','agents');
// Agent differences are data. Every merged agent card must parse and carry the
// fields its kind needs — a card missing readiness/submission patterns or a
// fallback command is a dispatch stall waiting to happen. The card is the old
// Orca adapter card at top level plus an optional `capabilities:` key.
//
// The yaml parser is canonical at engine/yaml.mjs post-flip (core/ is doomed);
// resolve whichever exists so this spec runs before and after the move.
const YAML_MODULE=await (async()=>{
  for(const p of ['../engine/yaml.mjs','../core/yaml.mjs']){
    if(!fs.existsSync(path.join(ROOT,p.slice(3))))continue;
    try{return await import(p);}catch{/* landed but not yet wired — fall back */}
  }
  throw new Error('no importable yaml module at engine/ or core/');
})();
const {parseYaml}=YAML_MODULE;

const cards=fs.readdirSync(ADAPTERS).filter(f=>f.endsWith('.yaml')).sort();
assert.ok(cards.length>0,'modules/models/agents holds no cards');

const KINDS=['command-terminal-agent','native-managed-agent'];

for(const file of cards){
  test(`agent card ${file} parses and carries the fields its kind needs`,()=>{
    const card=parseYaml(fs.readFileSync(path.join(ADAPTERS,file),'utf8'));
    assert.ok(card&&typeof card==='object',`${file} did not parse to an object`);
    assert.equal(card.schema,'starci/agent-card@1',`${file} schema`);
    assert.equal(card.agent,path.basename(file,'.yaml'),`${file} agent name must equal the filename`);
    assert.ok(KINDS.includes(card.kind),`${file} kind '${card.kind}' is not a known adapter kind`);

    if(card.kind==='command-terminal-agent'){
      // The spawnable path: either declared requirement flags or a fallback command body.
      const hasReqs=Array.isArray(card.commandRequirements)&&card.commandRequirements.length>0;
      const hasFallback=typeof card.terminalFallback?.command==='string'&&card.terminalFallback.command.trim().length>0;
      assert.ok(hasReqs||hasFallback,`${file}: command-terminal-agent needs commandRequirements or terminalFallback.command`);
      assert.equal(typeof card.readiness?.screenPattern,'string',`${file}: readiness.screenPattern is how spawn proves the prompt rendered`);
      const sub=card.submission??{};
      assert.ok(typeof sub.activityPattern==='string'||typeof sub.stagedPattern==='string',
        `${file}: submission needs an activity or staged pattern — else prompt delivery is never attested`);
    }

    if(card.kind==='native-managed-agent'){
      // The managed path: orchestration starts the worker; the terminal fallback is the escape hatch.
      assert.equal(card.start?.api,'orchestration.worker-start',`${file}: native-managed agents start via orchestration.worker-start`);
      assert.equal(typeof card.terminalFallback?.command,'string',`${file}: native-managed agents still need a terminalFallback.command`);
    }
  });
}
