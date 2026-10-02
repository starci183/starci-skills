import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkApplicationStacks} from '../../scripts/gates/stacks-gate.mjs';

// The stack kit of the ecommerce app: its app root's .starcistacks tree, its sops rule and the .gitignore whose managed block holds the custody rules.
const source=path.resolve(import.meta.dirname,'..', '..', 'examples', 'ecommerce-app');
const KIT=['.starcistacks','.sops.yaml','.gitignore'];

test('portable application-stack kit is complete and statically safe in dev',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-application-kit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const entry of KIT)fs.cpSync(path.join(source,entry),path.join(root,entry),{recursive:true});
  // dev runs postgres/keycloak/redis/minio by default; identity and order are behind the
  // `app` Compose profile and run on the host per the dev README, so a plain `up` never renders them.
  const devModel={services:{postgres:{},keycloak:{},redis:{},minio:{}}};
  for(const [environment,model] of [['dev',devModel]]){
    const modelFile=path.join(root,`${environment}-compose-model.json`);fs.writeFileSync(modelFile,JSON.stringify(model));
    const checked=checkApplicationStacks({repoRoot:root,environment,deploymentModelFile:modelFile});
    assert.equal(checked.ok,true,checked.errors.map(error=>`${error.code}:${error.path??''}:${error.message}`).join('\n'));
  }
  // Portable means each copied environment runbook still declares its prepare command: prepare is a runbook row
  // (modules/schemas/stacks-layout.yaml), not a scripts/prepare.* file - the app.scripts slot never requires one.
  for(const environment of ['dev']){
    const runbook=fs.readFileSync(path.join(root,'.starcistacks',environment,'README.md'),'utf8');
    assert.match(runbook,/^| prepare |/m,environment);
    assert.equal(fs.existsSync(path.join(root,'scripts','prepare.sh')),false,'no scripts/prepare.* is assumed');
  }
});
