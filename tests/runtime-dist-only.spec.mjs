import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
test('relocated runtime uses only .dist and bootstrap, never authored code or data', t=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'starci-dist-only-'));
  t.after(()=>{assert.equal(path.dirname(base),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(base).startsWith('starci-dist-only-'));fs.rmSync(base,{recursive:true,force:true});});
  fs.cpSync(path.join(root,'.dist'),path.join(base,'.dist'),{recursive:true});
  fs.copyFileSync(path.join(root,'SKILL.md'),path.join(base,'SKILL.md'));
  fs.mkdirSync(path.join(base,'bin'));
  fs.copyFileSync(path.join(root,'bin/starci.mjs'),path.join(base,'bin/starci.mjs'));
  const run=args=>{
    const result=spawnSync(process.execPath,args,{cwd:base,encoding:'utf8',timeout:60000,windowsHide:true});
    assert.equal(result.status,0,result.stderr||result.stdout);
    return result.stdout;
  };
  const work=path.join(base,'project/.starciwork');
  fs.mkdirSync(path.dirname(work));
  run(['bin/starci.mjs','workspace','init',work,'--id','dist-only']);
  run(['bin/starci.mjs','validate',work]);
  assert.equal(JSON.parse(run(['bin/starci.mjs','workflows'])).workflows.length,16);
  run(['bin/starci.mjs','op','backend.implement']);
  run(['--input-type=module','-e',`import {resolveProjectSkillPath} from './.dist/workflows/lifecycle.mjs';
    import {selectProfile} from './.dist/profiles/select.mjs';
    import {selectWorkflow} from './.dist/workflows/select.mjs';
    import {readDistJson} from './.dist/core/runtime-root.mjs';
    if(!resolveProjectSkillPath().endsWith('SKILL.md'))throw Error('wrong skill root');
    const result=selectWorkflow(readDistJson('workflows','catalog.json'),{classification:{action:'implement-backend',effectful:true}});
    if(result.id!=='implement-backend')throw Error('wrong route');
    selectProfile({runtime:'codex',op:'backend.implement'});`]);
  for(const name of ['core','cli','scripts','contracts','specifications','workflows','knowledge','profiles','schemas'])assert.equal(fs.existsSync(path.join(base,name)),false,'source dependency leaked: '+name);
});
