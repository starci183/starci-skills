import test from 'node:test';
import assert from 'node:assert/strict';
import {DONE_HEADING,SEQUENCES,STEPS_HEADING,sequenceFor,stepsFor} from '../kernel/contract.mjs';
import {CUT_ASSERTIONS,CUT_FILES} from '../kernel/sync.mjs';

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
    'work.intake':[op({kind:'work.author',origin:'ledger',intake:{scope:'collab',example:'features/sales'},allowlist:['.starciwork/features/collab/**'],
      references:['workspace.yaml','features/sales/index.yaml'],acceptance:['features/collab has a module record, a business overview, SRS records and an architecture skeleton, all todo and valid']}),null],
    'work.migrate':[op({kind:'work.author',origin:'ledger',intake:{scope:'sales',example:'features/payments',mode:'migrate'},
      allowlist:['.starciwork/features/sales/index.yaml','.starciwork/features/sales/business/**','.starciwork/features/sales/architecture/**','.starciwork/features/sales/integration/**'],
      references:['workspace.yaml','features/sales/index.yaml','features/payments/business/overview/index.yaml'],
      acceptance:['the module record of sales carries extensions.work3.reconciliation','no decided record of sales changed']}),null],
    'work.cut':[op({kind:'implementation.plan',origin:'ledger',nodeId:'demo.sales.implementation.backend.checkout',
      cut:{node:'demo.sales.implementation.backend.checkout',reason:'its write scope names 21 files, past the 12 one operation may hold'},
      allowlist:['.starciwork/features/sales/implementation/backend/checkout/**'],
      references:['features/sales/implementation/backend/checkout/index.yaml','features/sales/architecture/sds/checkout/index.yaml'],
      acceptance:['exactly one child is the seam, and every other child dependsOn it','the tree validates']}),{kind:'implementation'}],
    'owner.ask':[op({kind:'owner.ask',origin:'ask',question:{kind:'credential',text:'Which Telegram bot token does the chatbot use, and where is it provided?',options:[],from:'op-intake'},allowlist:['.starciwork/features/chatbot/business/srs/business-rules/policy-decisions/**'],references:['features/chatbot/business/overview/index.yaml'],acceptance:['the question is answered from a decided record or drafted as one decision record']}),null],
    'implement.ledger':[op(),{kind:'implementation'}],
    'implement.shared':[op({origin:'shared',requesters:['op-catalog']}),null],
    'implement.repair':[op({origin:'repair',findings:['intake.ts:12 breaks unit-tests-pass']}),null],
    'implement.gate':[op({origin:'gate',findings:['lint failed (exit 1): 3 errors']}),null],
    'review.verify':[op({kind:'review.verify',origin:'verify'}),null],
    'interface.draw':[op({kind:'interface.draw',origin:'interface',allowlist:['features/sales/ui/intake/index.yaml'],checks:[]}),{kind:'ui'}],
    'interface.asset':[op({kind:'interface.asset',origin:'interface',allowlist:['apps/web/public/assets/intake'],checks:[]}),{kind:'ui'}],
    'frontend.implement':[op({kind:'frontend.implement',allowlist:['src/screens/intake/page.tsx']}),{kind:'implementation',inputRef:'features/sales/implementation/frontend/intake/index.yaml'}],
    uat:[op({kind:'task.execute',allowlist:['e2e/checkout.spec.ts'],resources:['e2e-runtime']}),{kind:'uat'}],
    'e2e.verify':[op({kind:'e2e.verify',allowlist:['src/tests/e2e/checkout.e2e-spec.ts'],resources:['e2e-runtime'],acceptance:['order-persisted']}),{kind:'uat'}],
    'integration.verify':[op({kind:'integration.verify',origin:'ledger',allowlist:['src/tests/integration/telegram.live-spec.ts'],
      references:['features/sales/integration/telegram/index.yaml','features/sales/architecture/sds/delivery/index.yaml'],
      acceptance:['a message reaches the telegram sandbox chat']}),{kind:'integration',path:'features/sales/integration/telegram/index.yaml'}],
    'uat.verify':[op({kind:'uat.verify',allowlist:['uat/checkout/runs/1/run.md'],resources:['e2e-runtime']}),{kind:'uat'}],
    operations:[op({kind:'runtime.operate',allowlist:['ops/rotate.sh'],resources:['postgres']}),{kind:'operations'}],
    migration:[op({allowlist:['src/migrations/0007-orders.ts'],resources:['postgres']}),{kind:'implementation'}],
    'architecture.revise':[op({kind:'architecture.revise',origin:'sds-gap',allowlist:['features/sales/architecture/sds/intake/index.yaml'],findings:['intake has no rule for an expired cart']}),null],
    'business.revise':[op({kind:'business.revise',origin:'business',allowlist:['features/sales/business/srs/intake/index.yaml'],findings:['the intake requirement does not say whether a partial order is billable']}),{kind:'business'}],
    'grammar.update':[op({kind:'grammar.update',origin:'architecture',allowlist:['/grammars/starci/**'],
      findings:['no contract renders a stepped progress rail'],acceptance:['the grammar renders a stepped progress rail']}),{kind:'implementation'}],
    decide:[op({kind:'architecture.decide',origin:'architecture',allowlist:['features/sales/architecture/sds/intake/index.yaml'],checks:[]}),null],
    'brand.decide':[op({kind:'brand.decide',origin:'architecture',allowlist:['brand/index.yaml'],
      acceptance:['every colour token names its source file'],checks:[{name:'unit-tests-pass',command:'npx vitest run intake'}]}),{kind:'brand'}],
    generic:[op({kind:'task.execute',origin:'plan'}),null]
  };
  assert.deepEqual(Object.keys(samples).sort(),[...SEQUENCES].sort());
  for(const [key,[operation,node]] of Object.entries(samples)){
    assert.equal(sequenceFor(operation,{node}),key,`sequence of ${key}`);
    const text=stepsFor(operation,{node});
    assert.ok(text.startsWith(STEPS_HEADING),`${key} starts with the heading`);
    assert.match(text,new RegExp(`Sequence \`${key.replace('.','\\.')}\``));
    // A working order stays readable: five steps at the least, eight at the most. The three frontend design
    // and build sequences sit at the top of that range because each of them carries the artwork slots too.
    assert.ok(steps(text).length>=5&&steps(text).length<=8,`${key} has ${steps(text).length} steps`);
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
  assert.match(text,/installed design grammar/);assert.match(text,/invent no component, token, colour or icon of your own/);assert.match(text,/design binding/);
  assert.match(text,/interface design record at the path the allowlist names \(`features\/sales\/ui\/intake\/index\.yaml`\)/);
  assert.match(text,/blueprint \(the regions in order\)/);assert.match(text,/contract slots/);assert.match(text,/the exact copy/);
  // The candidate is the grammar rendering the screen's main state in a browser; other states are described, not drawn.
  assert.match(text,/Render ONE candidate per screen and viewport \(desktop and mobile\) - the main state only - FROM THE INSTALLED GRAMMAR ITSELF/);
  assert.match(text,/Never an image model for a surface/);assert.match(text,/never a capture of a working feature/);
  assert.match(text,/loading, empty and error are the grammar's own state contracts and the build renders them from code/);
  // The markup the browser rendered is kept beside the picture, so the render can be checked from its source.
  assert.match(drawn[4],/KEEPING THE MARKUP IT RENDERED beside each PNG as `<candidate>\.html`/);
  assert.match(drawn[4],/a candidate that is not the grammar rendering the screen is a defect, and so is one with no markup beside it/);
  // The artwork the chosen candidate embeds is declared, so nothing of the approved picture is lost at build time.
  assert.match(drawn[5],/List every artwork the chosen candidate embeds/);
  for(const part of ['each illustration','each appearance of the brand mascot','each decorative image','each chart or media placeholder'])assert.ok(drawn[5].includes(part),part);
  assert.match(drawn[5],/as an `artworkSlots` entry/);
  for(const field of ['id','screen','state','region \\(the blueprint region it sits in\\)','purpose','brief \\(the prompt that reproduces it\\)','size \\{w, h, viewport\\}','format','references','crop \\{x, y, w, h\\} of the candidate it was taken from'])
    assert.match(drawn[5],new RegExp(field),field);
  assert.match(drawn[5],/A candidate whose embedded artwork the record does not list is an incomplete record/);
  assert.match(drawn[6],/every artwork visible in the chosen candidate has its `artworkSlots` entry with a crop that locates it/);
  // The self-check names the two canon rules of 2026-09-13 and the command that reads them from the bytes.
  assert.match(drawn[6],/NO CANDIDATE PLACES A LIST OF ENTITIES INSIDE A CARD \(a collection is a page section with a heading; a card is one item\)/);
  assert.match(drawn[6],/EVERY COLOUR THE CAPTURE IS LARGELY MADE OF IS A BRAND TOKEN and the brand's primary is present/);
  assert.match(drawn[6],/THE MASCOT APPEARS ONLY WHERE THE BRAND RECORD ALLOWS IT/);
  assert.match(drawn[6],/`starci render check <ui node dir> --brand <work root>`/);
  assert.match(text,/the two canon rules hold in the candidates themselves and `starci render check` says so/);
  assert.match(text,/with the markup it was rendered from kept beside it as `<candidate>\.html`/);
  assert.match(text,/every artwork the chosen candidate embeds is declared as an `artworkSlots` entry with its region, purpose, brief, size, format, brand references and candidate crop; a candidate with artwork the record does not list is incomplete/);
  assert.match(text,/every assertion \(`intake-screen-shows-every-state`\) maps to a named screen state/);
  assert.match(text,/`blocked` with blocker `sds-gap` and the exact question, never a guess/);
  // A design operation writes no product code and carries no red-spec rule.
  assert.doesNotMatch(text,/MUST fail now/);assert.match(text,/no product code/);
  assert.match(text,/Lane: the feature's `ui` node is its interface design record and walks `interface\.draw` -> `interface\.asset` \(when the record declares artwork slots\); each frontend implementation node is held until that record is done, then walks `frontend\.implement` -> `uat\.verify` against it and is done only after `uat\.verify`\./);
});

test('interface.asset re-renders each declared slot from the approved candidate and the brand masters, writes only asset paths, and records slot -> file back into the record',()=>{
  const text=stepsFor(op({kind:'interface.asset',origin:'interface',allowlist:['apps/web/public/assets/intake'],checks:[],
    references:['features/sales/ui/intake/index.yaml'],acceptance:['intake-screen-shows-every-state']}),{node:{kind:'ui'}});
  const made=steps(text);
  assert.match(text,/Sequence `interface\.asset`/);
  // It reads the drawing's slots; it never authors one, and undeclared artwork goes back to the drawing.
  assert.match(made[0],/interface design record among the references \(`features\/sales\/ui\/intake\/index\.yaml`\) and its `artworkSlots`/);
  assert.match(made[0],/locate each slot's crop inside it/);
  assert.match(made[0],/`blocked` with blocker `interface-gap` naming the screen, state and region/);
  assert.match(made[0],/the drawing declares artwork, this operation never invents a brief/);
  assert.match(made[1],/brand record/);assert.match(made[1],/placements each one allows and forbids/);
  assert.match(made[2],/WITH THE IMAGE MODEL/);
  assert.match(made[2],/candidate crop and the brand masters it references as actual input references \(`-i`\)/);
  assert.match(made[2],/the artwork the person approved rather than a new one that matches the same words/);
  assert.match(made[2],/exactly the declared size and format, one file per slot/);
  // It writes asset files and the record, nothing else: wiring is the build's step.
  assert.match(made[3],/asset path the allowlist names \(`apps\/web\/public\/assets\/intake`\)/);
  assert.match(made[3],/no component, no stylesheet, no configuration and no other product file is touched here/);
  assert.match(made[3],/`blocked` with `shared-change` and the exact paths/);
  assert.match(made[4],/record `\{slot -> file, sha256\}` back into the design record/);
  assert.match(made[4],/Change no brief, region, size, format or crop/);
  assert.match(made[5],/git status/);
  assert.match(made[6],/slot -> file table \(slot id, file path, size, format, sha256\)/);
  assert.match(made[6],/`blocked` with blocker `brand-gap` naming the exact rule and the exact brief that conflict/);
  assert.match(made[6],/a scripted, hand-drawn or placeholder file is never a generated asset/);
  assert.match(made[6],/a slot left empty is never a `done`/);
  // It generates images, so it carries no red spec and changes no product code.
  assert.doesNotMatch(text,/MUST fail now/);
  assert.match(text,/no product code changed/);
  assert.match(text,/Lane: the feature's `ui` node is its interface design record and walks `interface\.draw` -> `interface\.asset`/);
  // Neither a node kind nor an origin reroutes it into a build or repair sequence.
  assert.equal(sequenceFor(op({kind:'interface.asset'})),'interface.asset');
  assert.equal(sequenceFor(op({kind:'interface.asset',origin:'repair',findings:['a']}),{node:{kind:'ui'}}),'interface.asset');
  assert.equal(sequenceFor(op({kind:'interface.asset'}),{node:{kind:'implementation',inputRef:'features/sales/implementation/frontend/intake/index.yaml'}}),'interface.asset');
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
  assert.match(built[0],/its `artworkSlots` with the file and sha256 each slot was generated to/);
  assert.match(built[0],/`blocked` with blocker `interface-gap` naming the missing screen, state or region instead of improvising a layout/);
  assert.match(built[1],/failing story\/spec per screen state in the record/);assert.match(built[1],/MUST fail now/);
  assert.match(built[2],/typed components of the installed design grammar only/);assert.match(built[2],/no screen the record does not describe/);
  // The generated artwork is consumed, never remade: the build imports the file the record names and nothing else.
  assert.match(built[3],/Wire every artwork slot: import the exact file the record names for that slot into the typed component bound to its region/);
  assert.match(built[3],/Never regenerate, redraw, resize beyond the declared slot, substitute another image or ship an empty region/);
  assert.match(built[3],/`blocked` with `interface-gap` or `brand-gap`, never an image you invented, picked or drew yourself/);
  assert.match(built[4],/stories and the skeleton of every layout you changed/);
  assert.match(built[5],/lint: `npm run lint`; typecheck: `npx tsc --noEmit`; unit: `npx vitest run intake`/);
  assert.match(built[6],/every `artworkSlots` entry is listed with the component and region it is wired into and the exact file it imports/);
  assert.match(built[6],/no screen or image exists that the record does not describe/);
  assert.match(built[7],/`blocked` `interface-gap`/);assert.match(built[7],/`blocked` `brand-gap` for artwork you cannot ship inside the brand rules/);
  assert.match(built[7],/`blocked` `shared-change` with the exact paths/);
  assert.match(text,/red before your change and is green after it/);
  assert.match(text,/every `artworkSlots` entry is wired into the component the record binds to its region, importing the generated file the record names - no artwork was regenerated, substituted or invented here/);
  assert.match(text,/Lane: the feature's `ui` node is its interface design record and walks `interface\.draw` -> `interface\.asset`/);
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
  // The artwork the lane generated is proven on screen, not assumed from the record.
  assert.match(walked[4],/every `artworkSlots` entry of that screen state - the declared artwork is visible in your screenshot, in its own region, and is the file the record names/);
  assert.match(walked[4],/A missing artwork, an empty region where a slot is declared, or a different image than the slot's file is that step failing/);
  assert.match(text,/every artwork slot of the screen states you walked is visible at its region in that step's screenshot and is the file the record names; a missing or different asset is a failed step/);
  assert.match(walked[5],/run record under the flow folder at the path the allowlist names \(`uat\/checkout\/runs\/20260912-1\/run\.md`\)/);
  assert.match(walked[6],/only when every step of the walk passed/);
  assert.match(walked[6],/a runtime that cannot start is `failed` with the exact reason \(an environment you cannot fix is `blocked` with `environment`\)/);
  assert.match(walked[6],/a walk that stopped early is `partial` or `failed`, never `done`/);
  assert.match(text,/never a `done`/);
  assert.match(text,/Lane: the feature's `ui` node is its interface design record and walks `interface\.draw` -> `interface\.asset`/);
});

test('both revise sequences state the readings, choose one, log why and move on - and ask only about money, authority or customer data',()=>{
  const design=op({kind:'architecture.revise',origin:'architecture',allowlist:['features/sales/architecture/sds/intake/index.yaml'],
    references:['features/sales/business/srs/intake/index.yaml'],findings:['intake has no rule for an expired cart'],
    checks:[{name:'work-valid',command:'node bin/starci.mjs validate .'}]});
  const requirement=op({kind:'business.revise',origin:'business',allowlist:['features/sales/business/srs/intake/index.yaml'],
    references:['features/payments/business/srs/refund/index.yaml'],findings:['the intake requirement does not say whether a partial order is billable'],
    checks:[{name:'work-valid',command:'node bin/starci.mjs validate .'}]});
  const cases=[{key:'architecture.revise',operation:design,record:'design (SDS)',where:'the SDS section'},
    {key:'business.revise',operation:requirement,record:'requirement (SRS)',where:'the requirement, rule or journey'}];
  for(const {key,operation,record,where} of cases){
    const text=stepsFor(operation);
    const revised=steps(text);
    assert.ok(text.includes(`Sequence \`${key}\``),key);
    assert.equal(revised.length,8,key);
    // 1: the gap itself. 2: the readings the record admits - and a record that admits one reading is not a gap.
    assert.match(revised[0],/gap report that opened this operation \(1 finding\)/,key);
    assert.ok(revised[0].includes(`exact ${record} passage it names`),key);
    assert.ok(revised[1].includes('readings that passage actually admits'),key);
    assert.ok(revised[1].includes('admits exactly one reading is not a gap'),key);
    // 3: the runtime chooses, from the accepted records, the other features' decided records and the conventions.
    assert.ok(revised[2].includes('most reasonable reading'),key);
    assert.ok(revised[2].includes("decided records of the OTHER features"),key);
    assert.ok(revised[2].includes('is not a reason to stop'),key);
    // The one exception, stated identically in both sequences: money, authority or customer data is never silent.
    assert.ok(revised[2].includes('UNLESS the readings differ in an observable outcome about MONEY'),key);
    assert.ok(revised[2].includes('AUTHORITY'),key);assert.ok(revised[2].includes('CUSTOMER DATA'),key);
    assert.ok(revised[2].includes('report `ask` exactly once with `question.kind: decision`'),key);
    assert.ok(revised[2].includes('ONE recommendation'),key);
    assert.ok(revised[2].includes('ONLY thing this operation may ever `ask` about'),key);
    // 4: the chosen reading goes into the record the allowlist names, and nothing else moves.
    assert.ok(revised[3].includes(`Write the chosen reading into ${where}`),key);
    assert.ok(revised[3].includes(`\`${operation.allowlist[0]}\``),key);
    assert.ok(revised[3].includes('no code file'),key);
    // 5: the rev and exactly one decision-log entry, in the shape schemas/work.schema.yaml documents.
    assert.ok(revised[4].includes("Bump that record's `rev`"),key);
    assert.ok(revised[4].includes('EXACTLY ONE entry to `extensions.work3.decisionLog`'),key);
    assert.ok(revised[4].includes('{rev, at, gap, chosen, why, alternatives}'),key);
    assert.ok(revised[4].includes('Never rewrite and never delete an earlier entry'),key);
    // 6-8: validate, self-audit, report the rev and the entry - and never ask for anything else.
    assert.match(revised[5],/work-valid: `node bin\/starci\.mjs validate \.`/,key);
    assert.ok(revised[6].includes('`rev` is higher than it was'),key);
    assert.ok(revised[6].includes('exactly one new entry naming this gap'),key);
    assert.ok(revised[7].includes('with the new `rev` and the decision-log entry'),key);
    assert.ok(revised[7].includes('an unclear record is revised, not asked about'),key);
    // A record revision never writes a spec or product code, so it carries no red-spec rule and no lane hint.
    assert.doesNotMatch(text,/MUST fail now/,key);
    assert.doesNotMatch(text,/Lane: the feature's `ui` node/,key);
    assert.ok(text.includes('no product code changed and no other passage of this record, and no other record, moved'),key);
    assert.ok(text.includes('exactly one new `{rev, at, gap, chosen, why, alternatives}` entry'),key);
  }
  // Each sequence escapes to the OTHER record's gap rather than answering it in the wrong layer.
  assert.match(stepsFor(design),/really a missing or self-contradictory REQUIREMENT is `blocked` `srs-gap`/);
  assert.match(stepsFor(requirement),/really a missing DESIGN[\s\S]*is `blocked` `sds-gap`/);
});

test('grammar.update tries the composition of existing contracts first and publishes only behind green gates',()=>{
  const operation=op({kind:'grammar.update',origin:'architecture',allowlist:['/grammars/starci/**','/knowledge/grammars/**'],
    references:['features/sales/ui/index.yaml','knowledge/grammars/starci/family.yaml'],
    findings:['no contract renders a stepped progress rail'],acceptance:['the grammar renders a stepped progress rail'],
    checks:[{name:'grammar-gates',command:'npm run gate:grammar'}]});
  const text=stepsFor(operation,{node:{kind:'implementation'}});
  const grown=steps(text);
  assert.match(text,/Sequence `grammar\.update`/);
  // Whatever the origin or the node it came from, growing the language is its own sequence, never a product build.
  assert.equal(sequenceFor(operation,{node:{kind:'implementation'}}),'grammar.update');
  assert.equal(sequenceFor({...operation,origin:'repair'},{node:{kind:'ui'}}),'grammar.update');
  assert.equal(sequenceFor({...operation,origin:'shared'},{node:null}),'grammar.update');
  // Read the gap and the WHOLE canon first; a gap that is really a missing rule or screen goes back, not forward.
  assert.match(grown[0],/gap report that opened this operation \(1 finding\)/);
  assert.match(grown[0],/WHOLE installed canon/);
  assert.match(grown[0],/`blocked` `sds-gap` or `interface-gap`/);
  // The compose-first rule: a shape that composes is reported as the composition and the grammar is left alone.
  assert.match(grown[1],/FIRST try to express the shape as a composition of existing contracts/);
  assert.match(grown[1],/write that attempt down/);
  assert.match(grown[1],/report `done` with the composition, change nothing in the grammar/);
  assert.match(grown[2],/Only when it does not compose/);
  assert.match(grown[2],/primitive \(a fixed semantic unit\) or a block \(it carries feature meaning\)/);
  assert.match(grown[2],/`ask` with the composition attempt attached, never a guess/);
  assert.match(grown[3],/inside the allowlist \(`\/grammars\/starci\/\*\*`, `\/knowledge\/grammars\/\*\*`\)/);
  assert.match(grown[3],/failing on the revision you started from/);
  // The publish gate: every gate green first, the publish is irreversible, and the version is read back.
  assert.match(grown[4],/grammar-gates: `npm run gate:grammar`/);
  assert.match(grown[4],/only when every one is green publish a new version/);
  assert.match(grown[4],/The publish is irreversible/);
  assert.match(grown[4],/npm view <pkg>@<version>/);
  assert.match(grown[5],/`blocked` with `shared-change` and the exact manifest paths/);
  assert.match(grown[6],/Record the unit in the canon/);
  assert.match(grown[7],/report `done` exactly once with the unit, the exact published version and the canon entries/);
  const done=text.split('## Definition of done for this kind')[1];
  assert.match(done,/composition of existing contracts was tried first/);
  assert.match(done,/exactly one semantic unit/);
  assert.match(done,/red on the revision you started from and green after your change/);
  assert.match(done,/read back from the registry as actually served/);
  assert.match(done,/no product page, no screen and no second unit/);
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

test('brand.decide reads every value out of a real source file, bumps the rev, and asks instead of picking a colour',()=>{
  const brand=op({kind:'brand.decide',origin:'architecture',allowlist:['brand/index.yaml'],
    references:['business/overview/index.yaml'],acceptance:['every colour token names its source file'],
    checks:[{name:'brand-checks',command:'node bin/starci.mjs brand check .'}]});
  const text=stepsFor(brand,{node:{kind:'brand'}});
  const settled=steps(text);
  assert.match(text,/Sequence `brand\.decide`/);
  assert.match(settled[0],/business\/overview\/index\.yaml/);
  assert.match(settled[0],/rulings the owner has already made about identity/);
  // Nothing in the record is chosen: every value is read out of a file and traceable back to it.
  assert.match(settled[1],/Open the real token and style files/);
  assert.match(settled[1],/the grammar token name the renderer actually consumes/);
  assert.match(settled[1],/A value you cannot trace to a declaration is not yours to choose/);
  assert.match(settled[2],/whether the danger role may share the primary value/);
  assert.match(settled[2],/minimum contrast/);
  assert.match(settled[3],/only when no mascot asset exists at all, generate ONE placeholder with the image model/);
  assert.match(settled[3],/never describe a missing file as generated/);
  assert.match(settled[4],/record at the path the allowlist names \(`brand\/index\.yaml`\)/);
  assert.match(settled[4],/prompt rules oblige every later image prompt to name this identity/);
  assert.match(settled[4],/no product code/);
  assert.match(settled[5],/brand-checks: `node bin\/starci\.mjs brand check \.`/);
  assert.match(settled[5],/bump the record's `rev`/);
  // The two refusals: an untraceable value is a question, a missing source file is the user's environment.
  assert.match(settled[6],/`ask` naming the token and the file it should live in, never a colour you picked/);
  assert.match(settled[6],/`blocked` with `environment` and the exact path/);
  assert.match(text,/every token value is traceable to a declaration in one of those files/);
  // A decision operation writes no product code and carries no red-spec rule.
  assert.doesNotMatch(text,/MUST fail now/);
  assert.doesNotMatch(text,/Lane: the feature's `ui` node/);
  // The node kind alone reaches the sequence, and an authoring or review op on a brand node keeps its own.
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'brand'}}),'brand.decide');
  assert.equal(sequenceFor(op({kind:'brand.decide'})),'brand.decide');
  assert.equal(sequenceFor(op({kind:'work.author'}),{node:{kind:'brand'}}),'work.author');
  assert.equal(sequenceFor(op({kind:'review.verify'}),{node:{kind:'brand'}}),'review.verify');
});

test('the module carries no product path or repository name',async()=>{
  const fs=await import('node:fs');
  const source=fs.readFileSync(new URL('../kernel/contract.mjs',import.meta.url),'utf8');
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

/**
 * The cut is the one sequence whose ORDER is the whole point: the seam is named before anything else is, because
 * two builds that both edit the module wiring are not parallel work, they are one merge conflict with two
 * authors. The contract has to say that in numbers the kernel actually applies - the same twelve files and eight
 * assertions `kernel/sync.mjs` measured - and it has to say what the node it cuts becomes afterwards.
 */
test('work.cut names the seam first, cuts the rest by acceptance into disjoint children, and leaves a derived parent',()=>{
  const node='demo.sales.implementation.backend.checkout';
  const folder='.starciwork/features/sales/implementation/backend/checkout/**';
  const cut=op({kind:'implementation.plan',origin:'ledger',nodeId:node,
    cut:{node,reason:'its write scope names 21 files, past the 12 one operation may hold'},
    allowlist:[folder],
    references:['features/sales/implementation/backend/checkout/index.yaml','features/sales/architecture/sds/checkout/index.yaml'],
    acceptance:['exactly one child is the seam, and every other child dependsOn it','the tree validates'],
    checks:[{name:'work-tree-validates',command:'node bin/starci.mjs validate .'}]});
  const text=stepsFor(cut,{node:{kind:'implementation'}});
  const order=steps(text);
  assert.equal(sequenceFor(cut,{node:{kind:'implementation'}}),'work.cut');
  assert.match(text,/Sequence `work\.cut`/);
  // It reads the node and its design, then the real code, before it draws a single boundary.
  assert.match(order[0],/features\/sales\/architecture\/sds\/checkout\/index\.yaml/);
  assert.match(order[0],/the kernel measured it as too big because its write scope names 21 files/);
  assert.match(order[1],/Open the actual code the node's write scope names/);
  assert.match(order[1],/A boundary you have not read is not a boundary you may draw/);
  // The seam, first and by name - and what it owns is stated, not left to taste.
  assert.match(order[2],/Name the SEAM first, before any other part/);
  assert.match(order[2],/module wiring and registration, dependency-injection setup, database migrations, shared contracts, shared types and shared fixtures/);
  assert.match(order[2],/It is built first and alone/);
  // Then the rest, by acceptance, disjoint, each traced back to the same accepted records.
  assert.match(order[3],/Cut the rest by acceptance, never by file/);
  assert.match(order[3],/at most 12 files that is disjoint from every sibling AND from the seam/);
  assert.match(order[3],/every non-seam child carries the seam's node id in `dependsOn`/);
  assert.match(order[4],new RegExp(`\`${folder.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\``));
  assert.match(order[4],/`work\/node@2`, `kind: implementation`, `state: todo`, `required: true`/);
  // The node it cut becomes a derived parent, and its assertions become the group's acceptance.
  assert.match(order[5],/Turn demo\.sales\.implementation\.backend\.checkout into a derived parent/);
  assert.match(order[5],/`extensions\.work3\.groupAssertions`/);
  assert.match(order[5],/A parent with children authors no state/);
  assert.match(order[6],/work-tree-validates: `node bin\/starci\.mjs validate \.`/);
  assert.match(order[7],/report `done` with `cut: none`/);
  // It precedes every child's lane: nothing is built here and no red-spec rule applies.
  assert.doesNotMatch(text,/MUST fail now/);
  assert.match(text,/no product code changed: this operation precedes the children's lanes/);
  assert.match(text,/the seam first, then the rest at once, and one proof for the whole group/);
  // The definition of done carries both bounds and the one alternative outcome.
  assert.ok(done(text).some(line=>/no child states more than 8 assertions/.test(line)));
  assert.ok(done(text).some(line=>/or the report says `cut: none` and nothing under .* changed/.test(line)));
  // Neither the node kind nor a repair origin nor a migration-looking allowlist reroutes it.
  assert.equal(sequenceFor(op({kind:'implementation.plan',origin:'repair',allowlist:['db/migrations/1.sql']}),{node:{kind:'ui'}}),'work.cut');
  // And the record-authoring modes stay apart: a cut is never read as an intake or as a record completion.
  assert.equal(sequenceFor(op({kind:'work.author',cut:{node,reason:'x'}}),{node:{kind:'implementation'}}),'work.cut');
  assert.equal(sequenceFor(op({kind:'work.author',intake:{scope:'collab'}}),{node:null}),'work.intake');
  // The bounds in the contract are the bounds the kernel measured. A contract that states a limit the kernel
  // does not apply is worse than no contract: the agent would cut to a rule nobody enforces.
  assert.ok(text.includes(`at most ${CUT_FILES} files`),`the contract states CUT_FILES (${CUT_FILES})`);
  assert.ok(text.includes(`more than ${CUT_ASSERTIONS} assertions`),`the contract states CUT_ASSERTIONS (${CUT_ASSERTIONS})`);
});

/**
 * An intake is a reconciliation with exactly three cases, written as data. The contract has to say so in the
 * words the kernel then checks mechanically: the table key, the row fields, and what each case obliges. The
 * two rulings it must NOT carry any more are the old "fit, change or conflict" vocabulary and the `sds-gap`
 * report against another feature's record - a change a decided record needs is the owner's decision or new
 * work this feature declares, never an edit and never a gap filed against someone else's record.
 */
/**
 * A migration declares and never re-decides: the reconciliation and the integrations go onto the module record,
 * one integration node per declaration is authored, and no decided record is rewritten, re-versioned or set to
 * todo - the sentence that makes an intake rewrite every leaf as a draft is absent from this sequence.
 */
test('work.migrate declares the reconciliation and the integrations beside decided content and re-decides nothing',()=>{
  const migrate=op({kind:'work.author',origin:'ledger',intake:{scope:'sales',example:'features/payments',mode:'migrate'},
    allowlist:['.starciwork/features/sales/index.yaml','.starciwork/features/sales/business/**','.starciwork/features/sales/architecture/**','.starciwork/features/sales/integration/**'],
    references:['workspace.yaml','features/sales/index.yaml'],acceptance:['no decided record of sales changed'],
    checks:[{name:'work-valid',command:'node bin/starci.mjs validate .'}]});
  const text=stepsFor(migrate);
  const listed=steps(text),closed=done(text);
  assert.equal(sequenceFor(migrate),'work.migrate');
  assert.match(text,/Sequence `work\.migrate`/);
  assert.match(listed[0],/re-decides none of it/);
  assert.match(listed[1],/`extensions\.work3\.reconciliation`/);
  assert.match(listed[1],/leave both decided records byte for byte/);
  assert.match(listed[2],/`extensions\.work3\.integrations`/);
  assert.match(listed[2],/custody: identity:<slug>/);
  assert.match(listed[2],/Never a value/);
  assert.match(listed[3],/features\/<feature>\/integration\/<id>\/index\.yaml/);
  assert.match(listed[4],/nothing rewritten as a draft, nothing set to todo, nothing under implementation\/ or ui\/ touched/);
  assert.match(listed[5],/An error the validator reports under a path outside your allowlist is not yours/);
  assert.match(listed[6],/Report `ask` only for a provision the owner alone holds/);
  assert.doesNotMatch(text,/every leaf record `state: todo`/);
  assert.doesNotMatch(text,/Mirror the shape/);
  assert.ok(closed.some(line=>/no decided record of this feature changed its state, its rev or its substance/.test(line)));
  assert.ok(closed.some(line=>/no secret value appears in any record/.test(line)));
});

test('work.intake determines every side, then reconciles it as three typed cases, and edits no other feature',()=>{
  const intake=op({kind:'work.author',origin:'ledger',intake:{scope:'collab',example:'features/sales'},
    allowlist:['work/features/collab/**'],references:['workspace.yaml','features/sales/index.yaml'],
    acceptance:['features/collab has a module record, a business overview, SRS records and an architecture skeleton'],
    checks:[{name:'work-valid',command:'node bin/starci.mjs validate .'}]});
  const text=stepsFor(intake);
  const listed=steps(text),closed=done(text);
  assert.equal(sequenceFor(intake),'work.intake');
  // The sides come first: the feature is determined as checkable claims before anything is reconciled.
  assert.match(listed[1],/Determine the feature, do not just describe it/);
  for(const side of ['ARCHITECTURE','USER STORIES','SECURITY AND AUTHORITY','BUSINESS RULES','QUALITY','EXTERNAL INTEGRATIONS AND CREDENTIALS','OPEN DECISIONS'])
    assert.ok(listed[1].includes(side),`the sides sentence still names ${side}`);
  // The table is named by its key and by its row fields, exactly as the kernel reads them.
  assert.match(listed[2],/`extensions\.work3\.reconciliation`/);
  assert.match(listed[2],/`\{case, record, decision, reads, hands, detail\}`/);
  assert.match(listed[2],/There are exactly three cases and no fourth/);
  // reference: cited by id, never restated.
  assert.match(listed[2],/`case: reference`.*cite it by its `record` id and never restate, re-word or redefine a line of it/);
  // conflict: never overwritten, never averaged; the decision record is this feature's and the owner answers it.
  assert.match(listed[2],/`case: conflict`.*never overwrite it and never average the two/);
  assert.match(listed[2],/decision record under THIS feature \(`state: todo`\) stating both sides, the consequences of each, the numbered options and exactly one recommendation/);
  assert.match(listed[2],/name that record in `decision`/);
  assert.match(listed[2],/the kernel puts the question to the owner/);
  // new: authored here, declaring what it reads and what it hands on.
  assert.match(listed[2],/`case: new`.*declare in `reads` the decided records it rests on and in `hands` the records of this feature it hands on to/);
  // The definition of done repeats the table and the untouched neighbour, and the report carries the counts.
  assert.ok(closed.some(item=>/one row `\{case, record, decision, reads, hands, detail\}` per decided record/.test(item)));
  assert.ok(closed.some(item=>/every `reference` row cites a decided record by id and no record of this feature restates it/.test(item)));
  assert.ok(closed.some(item=>/no record of another feature changed by a single byte/.test(item)));
  assert.match(listed.at(-1),/the reconciliation table with its count per case/);
  // The two withdrawn rulings are gone from the whole sequence: no old vocabulary, no formula, no sds-gap.
  assert.doesNotMatch(text,/fit, a change or a conflict|fit, change or conflict/);
  assert.doesNotMatch(text,/sds-gap/);
  assert.doesNotMatch(text,/A'|A, B \+ C/);
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
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'e2e',path:'features/sales/e2e/checkout/index.yaml'}}),'e2e.verify');
  assert.equal(sequenceFor(op({kind:'task.execute'}),{node:{kind:'uat',path:'features/sales/implementation/frontend/checkout/index.yaml'}}),'uat.verify');
});

/**
 * The owner is at a keyboard, in front of this tab. Before 5-plus the ask op only drafted a record and left,
 * and a one-word answer waited a day for someone to type a command somewhere else. It asks here now, and the
 * two ways to answer are printed side by side. And a credential is never asked for as a value at all: the
 * owner puts it into the tree's own encrypted custody with one command and says `set`; the op checks presence.
 */
test('the owner.ask sequence asks in its own terminal, and a credential is put into custody by the owner, never handed over',()=>{
  const ask=op({kind:'owner.ask',origin:'ask',checks:[{name:'work-tree-validates',command:'node starci.mjs validate .starciwork'}],
    question:{kind:'credential',text:'Which key does the payment client use?',options:[],from:'op-intake'},
    allowlist:['.starciwork/features/sales/business/srs/business-rules/policy-decisions/**'],
    references:['features/sales/business/overview/index.yaml'],
    acceptance:['the question is answered from a decided record or drafted as one decision record']});
  const rendered=stepsFor(ask,{node:null});
  // A decided record still answers first, and nothing is written when one does.
  assert.match(rendered,/`answered-from: <record id>`/);
  // The question is put in this terminal, with both doors, before any report.
  assert.match(rendered,/ASK IN THIS TERMINAL, before you report/);
  assert.match(rendered,/the owner may answer here with the number, or later with workflow-answer/);
  // Only a provision or an irreversible effect is waited for; every other question is provisional and reported at once.
  assert.match(rendered,/A PROVISION \(a credential, an account on an outside system, a dataset, a legal authority\) or an IRREVERSIBLE effect is the owner's alone: wait for the answer/);
  assert.match(rendered,/do not wait - report `decision: <record id>` at once/);
  assert.match(rendered,/`answered-by-owner: <n>`/);
  // The recommendation is what the kernel takes provisionally, so it has to be reported as a number.
  assert.match(rendered,/`decision: <record id>`, then a line `recommended: <n>`/);
  assert.match(rendered,/takes your recommendation provisionally so the work continues/);
  // Custody, not a value: the owner's own command, presence only, and nothing printed.
  assert.match(rendered,/identity set <slug> --name <VAR>/);
  assert.match(rendered,/reads the value from stdin, never from the command line, and never prints it/);
  assert.match(rendered,/verify only PRESENCE and never the value/);
  assert.match(rendered,/`credential: <VAR> present in identity:<slug>`/);
  assert.match(rendered,/An environment variable is not custody/);
  assert.match(rendered,/Never print, echo, log, copy or paste the value/);
  assert.match(done(rendered).join('\n'),/no value of any credential or secret appears anywhere/);
  // The record is a policy decision where the tree keeps them, never a folder the tree does not have.
  assert.match(rendered,/srs-policy-decision` section with `decisionStatus: open`/);
  assert.match(rendered,/`\.starciwork\/features\/sales\/business\/srs\/business-rules\/policy-decisions\/\*\*`/);
});

/**
 * The sequence that closes the hole four faked chatbot channels went through: `e2e.verify` may still fake
 * an outside provider, but it must now name it in the evidence, and the only operation that can call a
 * declared provider proven is one that actually calls it.
 */
test('an integration is proven live or it is not proven: the credential is the owner\'s, no fake stands in, and e2e names what it faked',()=>{
  const live=op({kind:'integration.verify',origin:'ledger',allowlist:['src/tests/integration/telegram.live-spec.ts'],
    references:['features/sales/integration/telegram/index.yaml'],acceptance:['a message reaches the telegram sandbox chat'],
    checks:[{name:'integration',command:'npm run test:integration -- telegram'}]});
  const node={kind:'integration',path:'features/sales/integration/telegram/index.yaml'};
  const rendered=stepsFor(live,{node});
  assert.match(rendered,/Sequence `integration\.verify`/);
  // Every kind, origin and allowlist shape routes an integration node to this one sequence and no other.
  assert.equal(sequenceFor(live,{node}),'integration.verify');
  assert.equal(sequenceFor(op({kind:'task.execute',origin:'repair',allowlist:['db/migrations/9.sql']}),{node}),'integration.verify');
  assert.equal(sequenceFor(op({kind:'integration.verify'}),{node:null}),'integration.verify');

  // The credential: one named variable, out of the tree's own encrypted custody, read through sops at the
  // moment of use so the value lives in one process - never an environment variable the op exported, which
  // belongs to whichever terminal set it and is gone on the next machine. A custody that cannot give it stops
  // the work by name, with the slug and the variable.
  assert.match(rendered,/the encrypted identity resource the declaration's `custody` names/);
  assert.match(rendered,/_resources\/identity\/<slug>\/secrets\.enc\.yaml/);
  assert.match(rendered,/sops exec-env <work tree>\/_resources\/identity\/<slug>\/secrets\.enc\.yaml '<check>'/);
  assert.match(rendered,/Never an environment variable you export, never a file you create/);
  assert.match(rendered,/`blocked` with blocker `environment` naming the slug and that exact variable and nothing else/);
  assert.match(rendered,/never copy it into a file, a fixture, an environment file, a log, the report or this contract/);
  // The module is product-agnostic: it names the tree's layout, never a repository or a product path.
  assert.doesNotMatch(rendered,/\.starciwork/);
  // No double of any spelling may stand in for the provider, and the secret never leaves the variable name.
  assert.match(rendered,/No fake, no stub, no mock, no recorded or replayed response, no local double/);
  assert.match(rendered,/calling the real provider's own sandbox over the network/);
  assert.match(rendered,/every secret masked/);
  assert.match(rendered,/`proof: \{boundary: live, fakes: \[\]\}`/);
  assert.match(rendered,/only on a green live run/);
  assert.match(rendered,/a provider outage, a sandbox that will not answer or a rate limit is `failed`/);
  assert.match(rendered,/`npm run test:integration -- telegram`/);
  assert.match(rendered,/`src\/tests\/integration\/telegram\.live-spec\.ts`/);

  // The other half of the rule: an API proof may fake a provider, but the evidence has to name it.
  const api=stepsFor(op({kind:'e2e.verify',allowlist:['src/tests/e2e/checkout.e2e-spec.ts'],resources:['e2e-runtime'],
    acceptance:['order-persisted'],checks:[{name:'e2e',command:'npm run test:e2e -- checkout'}]}),{node:{kind:'e2e'}});
  assert.match(api,/`proof: \{boundary: api, fakes: \[<provider ids>\]\}`/);
  assert.match(api,/a provider the diff fakes that the evidence does not list is a defect/);
  assert.match(api,/its own `integration` node walking `integration\.verify`/);
});
