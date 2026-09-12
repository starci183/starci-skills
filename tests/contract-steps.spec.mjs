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
    'work.author':[op({kind:'work.author',origin:'ledger',nodeId:'demo.sales.implementation.backend.intake',
      allowlist:['work/features/sales/implementation/backend/intake/index.yaml'],
      acceptance:['the node declares an allowlist and checks that name its assertions','the tree validates']}),{kind:'implementation'}],
    'implement.ledger':[op(),{kind:'implementation'}],
    'implement.shared':[op({origin:'shared',requesters:['op-catalog']}),null],
    'implement.repair':[op({origin:'repair',findings:['intake.ts:12 breaks unit-tests-pass']}),null],
    'implement.gate':[op({origin:'gate',findings:['lint failed (exit 1): 3 errors']}),null],
    'review.verify':[op({kind:'review.verify',origin:'verify'}),null],
    'interface.draw':[op({kind:'interface.draw',origin:'interface',allowlist:['features/sales/ui/intake/index.yaml'],checks:[]}),{kind:'ui'}],
    'frontend.implement':[op({kind:'frontend.implement',allowlist:['src/screens/intake/page.tsx']}),{kind:'implementation',inputRef:'features/sales/implementation/frontend/intake/index.yaml'}],
    uat:[op({kind:'task.execute',allowlist:['e2e/checkout.spec.ts'],resources:['e2e-runtime']}),{kind:'uat'}],
    'e2e.verify':[op({kind:'e2e.verify',allowlist:['src/tests/e2e/checkout.e2e-spec.ts'],resources:['e2e-runtime'],acceptance:['order-persisted']}),{kind:'uat'}],
    'uat.verify':[op({kind:'uat.verify',allowlist:['uat/checkout/runs/1/run.md'],resources:['e2e-runtime']}),{kind:'uat'}],
    operations:[op({kind:'runtime.operate',allowlist:['ops/rotate.sh'],resources:['postgres']}),{kind:'operations'}],
    migration:[op({allowlist:['src/migrations/0007-orders.ts'],resources:['postgres']}),{kind:'implementation'}],
    'architecture.revise':[op({kind:'architecture.revise',origin:'sds-gap',allowlist:['features/sales/architecture/sds/intake/index.yaml'],findings:['intake has no rule for an expired cart']}),null],
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
  const text=stepsFor(op({kind:'task.execute',allowlist:['e2e/checkout.spec.ts'],resources:['e2e-runtime'],references:['uat/checkout/flow.md'],
    checks:[{name:'checkout-flow',command:'npx playwright test e2e/checkout.spec.ts'}]}),{node:{kind:'uat'}});
  assert.match(text,/`uat\/checkout\/flow\.md`: the flow, its seed and its accounts/);
  assert.match(text,/spec at the path the allowlist names \(`e2e\/checkout\.spec\.ts`\)/);
  assert.match(text,/runtime named in resources \(`e2e-runtime`\)/);
  assert.match(text,/checkout-flow: `npx playwright test e2e\/checkout\.spec\.ts`/);
  assert.match(text,/report `failed` with the exact reason; never `done` on an unrun spec/);
  assert.match(text,/a runtime that did not start is a `failed`, never a `done`/);
  // A ledger uat node reaches this spec sequence; the explicit uat.verify kind walks the surface instead.
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'uat'}}),'uat');
  assert.equal(sequenceFor(op({kind:'uat.verify'}),{node:{kind:'uat'}}),'uat.verify');
});

test('interface.draw enumerates every screen state and writes the design record before any code, and a missing business rule is an sds-gap',()=>{
  const text=stepsFor(op({kind:'interface.draw',origin:'interface',allowlist:['features/sales/ui/intake/index.yaml'],checks:[],
    references:['features/sales/business/srs/intake/index.yaml','features/sales/architecture/sds/intake/index.yaml'],
    acceptance:['intake-screen-shows-every-state']}),{node:{kind:'ui'}});
  const drawn=steps(text);
  assert.match(text,/Sequence `interface\.draw`/);
  assert.match(drawn[0],/features\/sales\/business\/srs\/intake\/index\.yaml/);
  assert.match(drawn[1],/enumerate every state it can be in before you draw anything/);
  for(const state of ['loading','empty','error','populated','permission-denied'])assert.ok(drawn[1].includes(state),`the state ${state} is enumerated`);
  assert.match(text,/installed design grammar/);assert.match(text,/invent no component family/);
  assert.match(text,/interface design record at the path the allowlist names \(`features\/sales\/ui\/intake\/index\.yaml`\)/);
  assert.match(text,/blueprint \(the regions in order\)/);assert.match(text,/contract slots/);assert.match(text,/the exact copy/);
  assert.match(text,/one rendered candidate per screen state/);assert.match(text,/never a capture of a working feature/);
  assert.match(text,/every assertion \(`intake-screen-shows-every-state`\) maps to a named screen state/);
  assert.match(text,/`blocked` with blocker `sds-gap` and the exact question, never a guess/);
  // A design operation writes no product code and carries no red-spec rule.
  assert.doesNotMatch(text,/MUST fail now/);assert.match(text,/no product code/);
  assert.match(text,/Lane: this op is one step of `interface\.draw` -> `frontend\.implement` -> `uat\.verify`; the node is done only after `uat\.verify`\./);
});

test('frontend.implement reads the design record first, refuses to invent a screen with interface-gap, and updates stories and skeletons',()=>{
  const text=stepsFor(op({kind:'frontend.implement',allowlist:['src/screens/intake/page.tsx','src/screens/intake/page.stories.tsx'],
    references:['features/sales/ui/intake/index.yaml'],acceptance:['intake-screen-renders-every-state'],
    checks:[{name:'lint',command:'npm run lint'},{name:'typecheck',command:'npx tsc --noEmit'},{name:'unit',command:'npx vitest run intake'}]}),
    {node:{kind:'implementation',inputRef:'features/sales/implementation/frontend/intake/index.yaml'}});
  const built=steps(text);
  assert.match(text,/Sequence `frontend\.implement`/);
  // Design before code: the record is step one and nothing may be invented beyond it.
  assert.match(built[0],/interface design record named in `features\/sales\/ui\/intake\/index\.yaml` first/);
  assert.match(built[0],/`blocked` with blocker `interface-gap` naming the missing screen and state instead of improvising a layout/);
  assert.match(built[1],/failing story\/spec per screen state in the record/);assert.match(built[1],/MUST fail now/);
  assert.match(built[2],/typed components of the installed design grammar only/);assert.match(built[2],/no screen the record does not describe/);
  assert.match(built[3],/stories and the skeleton of every layout you changed/);
  assert.match(built[4],/lint: `npm run lint`; typecheck: `npx tsc --noEmit`; unit: `npx vitest run intake`/);
  assert.match(built[5],/no screen exists that the record does not describe/);
  assert.match(built[6],/`blocked` `interface-gap`/);assert.match(built[6],/`blocked` `shared-change` with the exact paths/);
  assert.match(text,/red before your change and is green after it/);
  assert.match(text,/Lane: this op is one step of `interface\.draw` -> `frontend\.implement` -> `uat\.verify`/);
});

test('uat.verify walks the rendered surface with a screenshot per step, compares against the design record, and never reports done on a partial walk',()=>{
  const text=stepsFor(op({kind:'uat.verify',allowlist:['uat/checkout/runs/20260912-1/run.md'],resources:['e2e-runtime'],
    references:['uat/checkout/flow.md'],acceptance:['checkout-flow-passes'],
    checks:[{name:'seed',command:'npm run uat:seed -- checkout'}]}),{node:{kind:'uat'}});
  const walked=steps(text);
  assert.match(text,/Sequence `uat\.verify`/);
  assert.match(walked[0],/flow folder named in `uat\/checkout\/flow\.md`: the flow steps, its seed and its accounts/);
  assert.match(walked[1],/runtime named in resources \(`e2e-runtime`\)/);assert.match(walked[1],/seed: `npm run uat:seed -- checkout`/);
  assert.match(walked[2],/never through the API/);assert.match(walked[2],/a step proven by a request or a mutation is not walked/);
  assert.match(walked[3],/screenshot at every step/);assert.match(walked[3],/a step without a capture did not happen/);
  assert.match(walked[4],/interface design record and the node assertions \(`checkout-flow-passes`\)/);
  assert.match(walked[5],/run record under the flow folder at the path the allowlist names \(`uat\/checkout\/runs\/20260912-1\/run\.md`\)/);
  assert.match(walked[6],/only when every step of the walk passed/);
  assert.match(walked[6],/a runtime that cannot start is `failed` with the exact reason \(an environment you cannot fix is `blocked` with `environment`\)/);
  assert.match(walked[6],/a walk that stopped early is `partial` or `failed`, never `done`/);
  assert.match(text,/never a `done`/);
  assert.match(text,/Lane: this op is one step of `interface\.draw` -> `frontend\.implement` -> `uat\.verify`/);
});

test('architecture.revise edits one SDS section, bumps rev, keeps the decision log and writes no code',()=>{
  const text=stepsFor(op({kind:'architecture.revise',origin:'sds-gap',allowlist:['features/sales/architecture/sds/intake/index.yaml'],
    references:['features/sales/business/srs/intake/index.yaml'],findings:['intake has no rule for an expired cart'],
    checks:[{name:'work-valid',command:'node bin/starci.mjs validate .'}]}));
  const revised=steps(text);
  assert.match(text,/Sequence `architecture\.revise`/);
  assert.match(revised[0],/gap report that opened this operation \(1 finding\)/);
  assert.match(revised[1],/Edit only that section inside the allowlist \(`features\/sales\/architecture\/sds\/intake\/index\.yaml`\)/);
  assert.match(revised[1],/no code file/);
  assert.match(revised[2],/Bump that section's `rev`/);assert.match(revised[2],/never rewrite or delete an earlier entry/);
  assert.match(revised[3],/work-valid: `node bin\/starci\.mjs validate \.`/);
  assert.match(revised[4],/`rev` is higher than it was/);assert.match(revised[4],/no product code/);
  assert.match(revised[5],/with the new `rev` and the sections you changed/);
  assert.match(revised[5],/`ask` with the exact question/);
  // A design revision never writes a spec or product code, so it carries no red-spec rule and no lane hint.
  assert.doesNotMatch(text,/MUST fail now/);
  assert.doesNotMatch(text,/Lane: this op is one step/);
  assert.match(text,/no product code changed and no other design section moved/);
});

test('the frontend lane resolves from the kind, from the node layout and from a legacy implementing kind',()=>{
  const frontendNode={kind:'implementation',inputRef:'features/sales/implementation/frontend/intake/index.yaml'};
  const backendNode={kind:'implementation',inputRef:'features/sales/implementation/backend/intake/index.yaml'};
  assert.equal(sequenceFor(op({kind:'interface.draw'}),{node:{kind:'ui'}}),'interface.draw');
  assert.equal(sequenceFor(op({kind:'interface.draw'})),'interface.draw');
  assert.equal(sequenceFor(op({kind:'architecture.revise'})),'architecture.revise');
  assert.equal(sequenceFor(op({kind:'frontend.implement'})),'frontend.implement');
  assert.equal(sequenceFor(op({kind:'frontend.implement'}),{node:frontendNode}),'frontend.implement');
  // Legacy implementing kinds on a frontend node reach the lane; a backend node keeps the ledger sequence.
  assert.equal(sequenceFor(op({kind:'backend.implement'}),{node:frontendNode}),'frontend.implement');
  assert.equal(sequenceFor(op({kind:'interface.implement'}),{node:frontendNode}),'frontend.implement');
  assert.equal(sequenceFor(op({kind:'backend.implement'}),{node:backendNode}),'implement.ledger');
  assert.equal(sequenceFor(op({kind:'backend.implement'})),'implement.ledger');
  // The node path may arrive as `path` or `file` instead of the ledger's `inputRef`.
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'ui',path:'features/sales/implementation/frontend/intake/index.yaml'}}),'frontend.implement');
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'implementation',file:'D:\\repo\\work\\features\\sales\\implementation\\frontend\\intake\\index.yaml'}}),'frontend.implement');
  // Origin still wins over the lane: findings and gates keep their own order, and a frontend node never becomes a migration.
  assert.equal(sequenceFor(op({kind:'frontend.implement',origin:'repair',findings:['a']}),{node:frontendNode}),'implement.repair');
  assert.equal(sequenceFor(op({kind:'frontend.implement',origin:'gate'}),{node:frontendNode}),'implement.gate');
  assert.equal(sequenceFor(op({kind:'frontend.implement',origin:'shared'}),{node:frontendNode}),'implement.shared');
  assert.equal(sequenceFor(op({kind:'frontend.implement',allowlist:['db/migrations/1.sql']}),{node:frontendNode}),'frontend.implement');
  // review.verify and uat.verify keep their own sequence even on a frontend node.
  assert.equal(sequenceFor(op({kind:'review.verify'}),{node:frontendNode}),'review.verify');
  assert.equal(sequenceFor(op({kind:'uat.verify'}),{node:frontendNode}),'uat.verify');
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
  // The two decision kinds are explicit about which question they answer and which layer they must not enter.
  assert.match(decide,/a business decision - what the product must do, written as requirement, rule or journey/);
  assert.match(decide,/the requirement it states and the journeys and rules it changes/);
  assert.match(decide,/no component, contract, schema or technology choice - that is an `architecture\.decide`/);
  const architecture=stepsFor(op({kind:'architecture.decide',origin:'architecture',allowlist:['features/payments/architecture/sds/refund/index.yaml'],checks:[]}));
  assert.match(architecture,/a design decision - how the system satisfies an accepted requirement, written as component, contract or mechanism/);
  assert.match(architecture,/the requirement \(SRS\) it must satisfy and the rest of the design \(SDS\) it must stay consistent with/);
  assert.match(architecture,/no new product rule, price or policy - that is a `business\.decide`/);
  assert.doesNotMatch(architecture,/a business decision - what the product must do/);
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

test('work.author completes the record from real material, keeps the kernel fields, builds nothing, and asks instead of guessing a scope',()=>{
  const record='work/features/sales/implementation/backend/intake/index.yaml';
  const author=op({kind:'work.author',origin:'ledger',nodeId:'demo.sales.implementation.backend.intake',
    allowlist:[record],references:['features/sales/implementation/backend/intake/index.yaml','features/sales/architecture/sds/intake/index.yaml'],
    acceptance:['the node declares an allowlist and checks that name its assertions','the tree validates'],
    checks:[{name:'work-valid',command:'node bin/starci.mjs validate .'}]});
  const text=stepsFor(author,{node:{kind:'implementation',inputRef:'features/sales/implementation/backend/intake/index.yaml'}});
  const authored=steps(text);
  assert.equal(sequenceFor(author,{node:{kind:'implementation'}}),'work.author');
  assert.match(text,/Sequence `work\.author`/);
  assert.match(authored[0],/features\/sales\/architecture\/sds\/intake\/index\.yaml/);
  assert.match(authored[0],/parent and sibling records/);
  // The scope is read out of the code, never invented, and an undetermined scope is a question.
  assert.match(authored[1],/Open the actual code/);
  assert.match(authored[1],/a path you have not opened is not a path you may write/);
  assert.match(authored[2],/testable assertions, one per observable outcome/);
  assert.match(authored[3],/one check per assertion into the record the allowlist names \(`work\/features\/sales\/implementation\/backend\/intake\/index\.yaml`\)/);
  assert.match(authored[3],/runnable verbatim/);
  // What stays the kernel's inside the one record this op may write.
  assert.match(authored[4],/never write `completion`/);
  assert.match(authored[4],/never write the kernel's own extension block/);
  assert.match(authored[4],/never write anything under the record's own evidence folder/);
  assert.match(authored[4],/keep the description, the references, `required`, `state` and `dependsOn` byte for byte/);
  assert.match(authored[5],/work-valid: `node bin\/starci\.mjs validate \.`/);
  assert.match(authored[6],/`ask` with the exact question/);
  assert.match(authored[6],/never an invented path or a command written in the hope that it exists/);
  // It precedes the lane: nothing is built here and no red-spec rule applies.
  assert.doesNotMatch(text,/MUST fail now/);
  assert.match(text,/no product code changed: this operation precedes the node's lane/);
  // A frontend node, a repair origin or a migration-looking allowlist never reroutes it.
  assert.equal(sequenceFor(op({kind:'work.author',origin:'repair',findings:['a']}),{node:{kind:'ui'}}),'work.author');
  assert.equal(sequenceFor(op({kind:'work.author',allowlist:['db/migrations/1.sql']}),{node:{kind:'uat'}}),'work.author');
});

test('e2e.verify proves a backend slice through the API on the real stack, never a screen, and a backend uat node resolves to it while a frontend one walks the surface',()=>{
  const e2e=op({kind:'e2e.verify',allowlist:['src/tests/e2e/checkout.e2e-spec.ts'],resources:['e2e-runtime'],acceptance:['order-persisted'],checks:[{name:'e2e',command:'npm run test:e2e -- checkout'}]});
  const rendered=stepsFor(e2e,{node:{kind:'uat'}});
  assert.match(rendered,/Sequence `e2e.verify`/);
  assert.match(rendered,/through the public API on the real stack/);
  assert.match(rendered,/never through a screen/);
  assert.match(rendered,/`npm run test:e2e -- checkout`/);
  assert.match(rendered,/never `done` on an unrun or partial spec/);
  assert.match(rendered,/prove step of `backend.implement` -> `e2e.verify` -> `review.verify`/);
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'uat',path:'features/sales/uat/checkout/index.yaml'}}),'uat');
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'uat',path:'features/sales/implementation/frontend/checkout/index.yaml'}}),'uat.verify');
});
