import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkApplicationStacks} from '../scripts/checks/stacks.mjs';

const source=path.resolve(import.meta.dirname,'../examples/todo-app-backend');

test('portable application-stack kit is complete and statically safe in dev and vps',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-application-kit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.cpSync(source,root,{recursive:true});
  // dev runs postgres/keycloak/redis/minio/prometheus by default; api and web are behind the
  // `app` Compose profile and run on the host per the dev README, so a plain `up` never renders them.
  const devModel={services:{postgres:{},keycloak:{},redis:{},minio:{},prometheus:{}}};
  const vpsModel={services:{
    postgres:{image:'postgres:16'},keycloak:{image:'quay.io/keycloak/keycloak:26.0'},redis:{image:'redis:7'},minio:{image:'minio/minio:latest'},
    api:{image:'todo-app/api',deploy:{replicas:2}},web:{image:'todo-app/web',deploy:{replicas:2}}}};
  for(const [environment,model] of [['dev',devModel],['vps',vpsModel]]){
    const modelFile=path.join(root,`${environment}-compose-model.json`);fs.writeFileSync(modelFile,JSON.stringify(model));
    const checked=checkApplicationStacks({repoRoot:root,environment,deploymentModelFile:modelFile});
    assert.equal(checked.ok,true,checked.errors.map(error=>`${error.code}:${error.path??''}:${error.message}`).join('\n'));
  }
  // Portable means the custody script survives the copy with its refusals intact.
  const prepare=fs.readFileSync(path.join(root,'scripts','prepare.sh'),'utf8');
  assert.match(prepare,/vps preparation requires --cipher-only/);
  assert.match(prepare,/age key must be outside the application root/);
});
