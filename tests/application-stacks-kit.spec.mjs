import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkApplicationStacks} from '../checks/stacks.mjs';

const source=path.resolve(import.meta.dirname,'../examples/application-stacks/tiny-stateful');

test('portable application-stack kit is complete and statically safe in dev and vps',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-application-kit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.cpSync(source,root,{recursive:true});
  for(const environment of ['dev','vps']){
    const env=path.join(root,'.stacks',environment);fs.writeFileSync(path.join(env,'secrets.yaml.enc'),'app_token: ENC[AES256_GCM,data:c3ludGhldGlj,iv:AA==,tag:AA==,type:str]\nsops:\n  age: []\n');
    if(environment==='dev')fs.writeFileSync(path.join(env,'secrets.yaml'),'app_token: '+('a'.repeat(64))+'\n');
    const service={image:'synthetic:1',deploy:{replicas:1},healthcheck:{test:['CMD','true']},networks:['app-net']};
    const model=environment==='dev'
      ?{services:{app:{environment:{APP_TOKEN_FILE:'/run/secrets/app_token'},secrets:[{source:'app-token',target:'app_token'}]},gateway:{}},secrets:{'app-token':{file:path.join(env,'secrets.yaml')}}}
      :{services:{app:{...service,environment:{APP_TOKEN_FILE:'/run/secrets/app_token'},secrets:[{source:'app-token',target:'app_token'}]},gateway:{...service}},networks:{'app-net':{driver:'overlay'}},secrets:{'app-token':{external:true,name:'tiny-stateful-app-token-v1'}}};
    const modelFile=path.join(root,`${environment}-compose-model.json`);fs.writeFileSync(modelFile,JSON.stringify(model));
    const checked=checkApplicationStacks({repoRoot:root,environment,deploymentModelFile:modelFile});
    assert.equal(checked.ok,true,checked.errors.map(error=>`${error.code}:${error.path??''}`).join(','));
  }
  const prepare=fs.readFileSync(path.join(root,'scripts','prepare.sh'),'utf8');
  assert.match(prepare,/encrypted secrets exist but the caller-owned age key is missing/);
  assert.doesNotMatch(prepare,/docker\s+(system\s+prune|volume\s+prune)/);
});
