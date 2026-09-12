import test from 'node:test';
import assert from 'node:assert/strict';
import {DONE_HEADING,SEQUENCES,STEPS_HEADING,sequenceFor,stepsFor} from '../execution/contract-steps.mjs';

/** A minimal operation the way `toOp` shapes one; every field an agent's steps interpolate is present. */
const op=(over={})=>({id:'op-1',kind:'backend.implement',origin:'ledger',nodeId:null,allowlist:['src/sales/intake.ts'],
  references:['features/sales/implementation/backend/intake/index.yaml'],checks:[{name:'unit-tests-pass',command:'npx vitest run intake'}],
  acceptance:['unit-tests-pass'],resources:[],requesters:[],findings:[],...over});
const steps=text=>text.split('\n').filter(line=>/^\d+\. /.test(line));
const done=text=>text.split(DONE_HEADING)[1].split('\n').filter(line=>line.startsWith('- '));

test('every sequence renders a numbered working order and a definition of done, and the key is named in the section',()=>{
  const samples={
    'implement.ledger':[op(),{kind:'implementation'}],
    'implement.shared':[op({origin:'shared',requesters:['op-catalog']}),null],
    'implement.repair':[op({origin:'repair',findings:['intake.ts:12 breaks unit-tests-pass']}),null],
    'implement.gate':[op({origin:'gate',findings:['lint failed (exit 1): 3 errors']}),null],
    'review.verify':[op({kind:'review.verify',origin:'verify'}),null],
    uat:[op({kind:'uat.verify',allowlist:['e2e/checkout.spec.ts'],resources:['e2e-runtime']}),{kind:'uat'}],
    operations:[op({kind:'runtime.operate',allowlist:['ops/rotate.sh'],resources:['postgres']}),{kind:'operations'}],
    migration:[op({allowlist:['src/migrations/0007-orders.ts'],resources:['postgres']}),{kind:'implementation'}],
    decide:[op({kind:'architecture.decide',origin:'architecture',allowlist:['features/sales/architecture/sds/intake/index.yaml'],checks:[]}),null],
    generic:[op({kind:'task.execute',origin:'plan'}),null]
  };
  assert.deepEqual(Object.keys(samples).sort(),[...SEQUENCES].sort());
  for(const [key,[operation,node]] of Object.entries(samples)){
    assert.equal(sequenceFor(operation,{node}),key,`sequence of ${key}`);
    const text=stepsFor(operation,{node});
    assert.ok(text.startsWith(STEPS_HEADING),`${key} starts with the heading`);
    assert.match(text,new RegExp(`Sequence \`${key.replace('.','\\.')}\``));
    assert.ok(steps(text).length>=5&&steps(text).length<=7,`${key} has ${steps(text).length} steps`);
    assert.ok(done(text).length>=2,`${key} has a definition of done`);
    assert.match(text,/Report `done` exactly once|report `done` exactly once/i);
    // Concrete: the op's own allowlist and check command are in the steps, never only generic wording.
    assert.ok(text.includes(`\`${operation.allowlist[0]}\``),`${key} names its allowlist`);
    if(operation.checks.length)assert.ok(text.includes('`npx vitest run intake`'),`${key} names its check command`);
    else assert.doesNotMatch(text,/Run every listed check/,`${key} runs no product check`);
  }
});

test('the implement sequences make the red spec mandatory and route out-of-allowlist work to blocked with shared-change',()=>{
  const text=stepsFor(op(),{node:{kind:'implementation'}});
  const [read,red,change,checks,audit,report]=steps(text);
  assert.match(read,/features\/sales\/implementation\/backend\/intake\/index\.yaml/);
  assert.match(read,/`unit-tests-pass`/);
  assert.match(red,/MUST fail now/);
  assert.match(red,/failed at the base head and pass after your change/);
  assert.match(change,/smallest change inside the allowlist \(`src\/sales\/intake\.ts`\)/);
  assert.match(checks,/unit-tests-pass: `npx vitest run intake`/);
  assert.match(audit,/git status/);assert.match(audit,/no TODO/);
  assert.match(report,/`blocked` with blocker `shared-change` and the exact paths/);
  assert.match(report,/`sds-gap`/);assert.match(report,/`ask` with the exact gap/);
  assert.match(text,/red before your change and is green after it/);
  // The two derived kinds keep the same red-first rule; the shared one forbids refactor and names its requester.
  assert.match(stepsFor(op({kind:'interface.implement'}),{node:{kind:'ui'}}),/MUST fail now/);
  const shared=stepsFor(op({origin:'shared',requesters:['op-catalog']}));
  assert.match(shared,/`op-catalog`/);assert.match(shared,/no refactor/);assert.match(shared,/requester's checks verbatim/);
  const repair=stepsFor(op({origin:'repair',findings:['a','b']}));
  assert.match(repair,/2 findings/);assert.match(repair,/finding -> fix map/);assert.match(repair,/confirm it fails now/);
  const gate=stepsFor(op({origin:'gate',findings:['lint failed (exit 1): 3 errors']}));
  assert.match(gate,/1 finding\b/);assert.match(gate,/exactly what the failing gate names/);
});

test('review.verify is read-only, runs every check itself, names file+line+assertion and never fixes',()=>{
  const text=stepsFor(op({kind:'review.verify',origin:'verify',checks:[{name:'unit-tests-pass',command:'npx vitest run intake'},{name:'lint',command:'npm run lint'}]}));
  assert.match(text,/read-only: change no product file/);
  assert.match(text,/Run every check of the group yourself, verbatim: unit-tests-pass: `npx vitest run intake`; lint: `npm run lint`/);
  assert.match(text,/file \+ line \+ the assertion it breaks/);
  assert.match(text,/Never fix anything/);
  assert.match(text,/`open\[\]` \(empty when the group is clean\)/);
  assert.doesNotMatch(text,/MUST fail now/);
});

test('uat reads the flow folder, writes the spec at the allowlisted path, runs it on the named runtime, and a runtime that cannot start is failed never done',()=>{
  const text=stepsFor(op({kind:'uat.verify',allowlist:['e2e/checkout.spec.ts'],resources:['e2e-runtime'],references:['uat/checkout/flow.md'],
    checks:[{name:'checkout-flow',command:'npx playwright test e2e/checkout.spec.ts'}]}),{node:{kind:'uat'}});
  assert.match(text,/`uat\/checkout\/flow\.md`: the flow, its seed and its accounts/);
  assert.match(text,/spec at the path the allowlist names \(`e2e\/checkout\.spec\.ts`\)/);
  assert.match(text,/runtime named in resources \(`e2e-runtime`\)/);
  assert.match(text,/checkout-flow: `npx playwright test e2e\/checkout\.spec\.ts`/);
  assert.match(text,/report `failed` with the exact reason; never `done` on an unrun spec/);
  assert.match(text,/a runtime that did not start is a `failed`, never a `done`/);
  // A ledger uat node reaches the same sequence without the uat.verify kind.
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'uat'}}),'uat');
});

test('operations and migrations apply, roll back and re-apply on a real container and never edit a committed migration',()=>{
  const migration=stepsFor(op({allowlist:['src/migrations/0007-orders.ts'],resources:['postgres']}),{node:{kind:'implementation'}});
  assert.match(migration,/Sequence `migration`/);
  assert.match(migration,/never edit an already-committed migration/);
  assert.match(migration,/real database container \(`postgres`\)/);
  assert.match(migration,/apply again to prove idempotence/);
  const operations=stepsFor(op({kind:'runtime.operate',allowlist:['ops/rotate.sh'],resources:['postgres']}),{node:{kind:'operations'}});
  assert.match(operations,/Sequence `operations`/);
  assert.match(operations,/Roll it back on the same container/);
  assert.match(operations,/a container that cannot start is a `failed`/);
  // The allowlist decides migration for any implementing kind, but a repair keeps its own sequence.
  assert.equal(sequenceFor(op({allowlist:['db/migrations/1.sql']})),'migration');
  assert.equal(sequenceFor(op({origin:'repair',allowlist:['db/migrations/1.sql']})),'implement.repair');
});

test('decide chooses among the closed options only and writes no code; unknown kinds fall back to generic',()=>{
  const decide=stepsFor(op({kind:'business.decide',origin:'business',allowlist:['features/payments/business/overview/index.yaml'],acceptance:['the overview records the decision']}));
  assert.match(decide,/among those options only/);
  assert.match(decide,/into the node file the allowlist names \(`features\/payments\/business\/overview\/index\.yaml`\); no code/);
  assert.match(decide,/never invent a new one silently/);
  assert.doesNotMatch(decide,/MUST fail now/);
  const generic=stepsFor(op({kind:'something.new',origin:'plan',checks:[],acceptance:[],references:[]}));
  assert.match(generic,/Sequence `generic`/);
  assert.match(generic,/they MUST fail now/);
  assert.match(generic,/none were declared; record the ones you ran/);
  assert.match(generic,/the goal and the allowlist above/);
  assert.equal(sequenceFor({kind:'',allowlist:[]}),'generic');
  assert.equal(sequenceFor(op({kind:'backend.implement',origin:'plan'})),'implement.ledger');
});

test('the module carries no product path or repository name',async()=>{
  const fs=await import('node:fs');
  const source=fs.readFileSync(new URL('../execution/contract-steps.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/starci-academy|agentos|nivo|apps\/|\.starciwork/i);
});
