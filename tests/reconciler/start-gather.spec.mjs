import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Native gather/row producers/summary; only service transport is a recorded down response.
test('native gather exposes every engine/controller/service row and counts their required failures', t => {
  const root = path.resolve(import.meta.dirname, '../..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-start-gather-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const service = pathToFileURL(path.join(root, 'scripts/reconciler/services.mjs')).href;
  const shim = path.join(dir, 'services.mjs'), loader = path.join(dir, 'loader.mjs');
  fs.writeFileSync(shim, `export * from ${JSON.stringify(service + '?recorded-gather-original')};
    export const serviceRegistry = () => [{ name: 'harness-ui', kind: 'service',
      probe: async () => ({ ok: false, error: 'recorded service connection refused' }) }];
    export const servicePorts = () => ({ harnessPublicUrl: null });`);
  fs.writeFileSync(loader, `const service=${JSON.stringify(service)},shim=${JSON.stringify(pathToFileURL(shim).href)};
    export async function resolve(specifier,context,nextResolve){
      const result=await nextResolve(specifier,context);
      return result.url===service?{url:shim,shortCircuit:true}:result;
    }`);
  const testing = pathToFileURL(path.join(root, 'scripts/reconciler/testing.mjs')).href;
  const startup = pathToFileURL(path.join(root, 'scripts/reconciler/start.mjs')).href;
  const code = `import assert from 'node:assert/strict';
    import { tempState } from ${JSON.stringify(testing)};
    const state=tempState();
    Object.assign(process.env,state.env,{STARCI_LOCAL_ROOT:state.dir,STARCI_OWNER_CONFIG_WITHIN:state.dir});
    try {
      const {gather,summarize}=await import(${JSON.stringify(startup)});
      const rows=await gather({env:process.env,config:{reconciler:{enabled:false}},orca:false,seats:false,
        workflowSeats:false,seatsRequested:false,platform:'linux',guardProbe:()=>({ok:false,error:'recorded missing launcher'})});
      assert.ok(rows.every(row=>row && !Array.isArray(row) && typeof row.status==='string'),'every checklist element is a plain row');
      const required=rows.filter(row=>row.required && row.status==='red');
      for(const [group,id] of [['engine','engine'],['controllers','mode:job'],['services','harness-ui']]){
        const row=rows.find(row=>row.group===group && row.id===id);
        assert.ok(row,group+' failure is exposed');
        assert.equal(row.status,'red');assert.equal(row.required,true);
        assert.deepEqual(summarize([row]),{ok:false,red:1,warn:0,green:0});
      }
      const summary=summarize(rows);
      assert.equal(summary.ok,false);assert.equal(summary.red,required.length);
      assert.ok(required.length>=3,'native down engine, off controller and unavailable service all gate readiness');
    } finally {state.close();}`;
  const result = spawnSync(process.execPath, ['--loader', pathToFileURL(loader).href, '--input-type=module', '-e', code],
    { cwd: root, env: { ...process.env, STARCI_OWNER_CONFIG_WITHIN: dir, STARCI_LOCAL_ROOT: dir }, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
