import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createTracer,renderPick,renderSettle,renderBlock,renderDefer} from '../kernel/trace.mjs';

/**
 * The debug trace of goal.md §7: debug off is silent, debug on writes the four line shapes to
 * `_local/workflows/<id>/trace.log`, and the log is append-only - every line derived from the journal
 * facts the kernel already recorded, same event rendered to the same line.
 */
const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-trace',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};
const DIGEST='9f83a2b1c4d2e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e';

test('debug off is silent: emit is a no-op and no trace.log is ever created',()=>{
  const dir=tmp();
  try{
    const file=path.join(dir,'trace.log');
    for(const tracer of [createTracer(),createTracer({debug:false,traceFile:file}),createTracer({debug:'true',traceFile:file}),createTracer({traceFile:file})]){
      assert.equal(tracer.enabled,false);
      for(const kind of ['pick','settle','block','defer'])assert.equal(tracer.emit(kind,{op:'build-1'}),null);
    }
    assert.equal(fs.existsSync(file),false,'a disabled tracer creates no file');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('debug on appends the four line shapes beside events.jsonl, creating the workflow directory',()=>{
  const dir=tmp();
  try{
    const file=path.join(dir,'_local','workflows','wf-1','trace.log');
    const tracer=createTracer({debug:true,traceFile:file});
    assert.equal(tracer.enabled,true);
    const pick=tracer.emit('pick',{op:'build-1',kind:'backend.implement',gap:'sales.checkout has no code',
      requires:['srs:settled','sds:open'],
      inputs:[{file:'src/sales/intake.ts',digest:DIGEST},'model/kinds.yaml'],
      model:{runtime:'codex-agent',model:'gpt-5.6-sol'},reason:'largest target-share deficit'});
    assert.equal(pick,`[pick]   op=build-1 vì=backend.implement sales.checkout has no code (requires srs:settled sds:open) input=src/sales/intake.ts@9f83a2b1c4d2,model/kinds.yaml model=codex-agent/gpt-5.6-sol — largest target-share deficit`);
    const settle=tracer.emit('settle',{op:'build-1',output:'the slice is built',delta:{remainingOps:4,durationMs:2700000,estimateMs:7200000}});
    assert.equal(settle,'[settle] op=build-1 output=the slice is built → remainingOps=4 durationMs=45min estimateMs=2h');
    const block=tracer.emit('block',{op:'build-2',kind:'sds-gap',detail:'the checkout contract has no retry policy',route:'architecture.revise',attempt:2,limit:3});
    assert.equal(block,'[block]  build-2: sds-gap "the checkout contract has no retry policy" → route architecture.revise (2/3)');
    const defer=tracer.emit('defer',{op:'build-3',reason:'no free slot on codex-agent (cooling)'});
    assert.equal(defer,'[defer]  build-3: no free slot on codex-agent (cooling)');
    assert.equal(fs.readFileSync(file,'utf8'),`${pick}\n${settle}\n${block}\n${defer}\n`);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('the log is append-only: pre-existing content and earlier lines are never rewritten',()=>{
  const dir=tmp();
  try{
    const file=path.join(dir,'trace.log');
    fs.writeFileSync(file,'# earlier generation\n');
    const tracer=createTracer({debug:true,traceFile:file});
    tracer.emit('defer',{op:'draw-1',reason:'brand missing',waitingFor:'brand-1'});
    tracer.emit('pick',{op:'draw-1',gap:'sales ui',inputs:{'.starciwork/features/sales/ui/index.yaml':DIGEST},model:'claude-agent/claude-opus-5',reason:'deficit'});
    const lines=fs.readFileSync(file,'utf8').split('\n');
    assert.equal(lines[0],'# earlier generation','the tracer never rewrites what is already there');
    assert.equal(lines[1],'[defer]  draw-1: brand missing (waiting on brand-1)');
    assert.equal(lines[2],`[pick]   op=draw-1 vì=sales ui input=.starciwork/features/sales/ui/index.yaml@9f83a2b1c4d2 model=claude-agent/claude-opus-5 — deficit`);
    assert.equal(lines.length,4);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('same event renders the same line: the renderers are pure and trace is a renderer of journal facts',()=>{
  const payload={op:'verify-1',kind:'srs-gap',detail:'share decision is not in the SRS',route:{kind:'business.revise',then:'reopen'},attempt:3,limit:3};
  assert.equal(renderBlock(payload),renderBlock(payload));
  assert.equal(renderBlock(payload),'[block]  verify-1: srs-gap "share decision is not in the SRS" → route business.revise then reopen (3/3)');
  assert.equal(renderSettle({op:'verify-1',output:'walked the flow',delta:{from:5,to:4}}),'[settle] op=verify-1 output=walked the flow → 5→4');
  // Missing fields degrade to `-`, never to `undefined` or a thrown read of the journal.
  assert.equal(renderPick({op:'x'}),'[pick]   op=x vì=- input=- model=- — -');
  assert.equal(renderDefer({op:'x'}),'[defer]  x: -');
});

test('a wiring error is loud: an unknown kind throws and debug on still needs its file',()=>{
  const dir=tmp();
  try{
    const tracer=createTracer({debug:true,traceFile:path.join(dir,'trace.log')});
    assert.throws(()=>tracer.emit('pikc',{op:'build-1'}),/Unknown trace kind pikc/);
    assert.throws(()=>createTracer({debug:true}),/traceFile/);
    assert.equal(fs.readdirSync(dir).length,0,'the failed emits wrote nothing');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('model-authored text is clipped to one line and never leaks a secret into the trace',()=>{
  const line=renderBlock({op:'ask-1',kind:'environment',detail:'missing API_KEY=sk-live-9QzQ, and a\nbearer abcdef123456 token',route:'needUser',attempt:1});
  assert.equal(line,'[block]  ask-1: environment "missing API_KEY=[redacted], and a bearer [redacted] token" → route needUser (1/-)');
  assert.ok(!line.includes('sk-live')&&!line.includes('abcdef123456'));
});
