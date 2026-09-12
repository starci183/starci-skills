/**
 * Kind-specific working order for an operation contract (5.0).
 *
 * The kernel keeps every bit of process authority - which operation runs, in what order, what is accepted -
 * and the Work ledger decides the order of operations. What an agent lacked was the order of work INSIDE one
 * operation: some wrote a green spec first, some skipped the design, some edited outside their allowlist.
 * `stepsFor` renders a mandatory, numbered sequence per operation kind, interpolated from the operation's own
 * values (allowlist, checks, acceptance, references, resources, requesters, findings), so the contract tells
 * the agent what to do first, what must be red before code, and how to report exactly once with the real
 * report vocabulary (`done|partial|failed|ask|blocked`; blockers `shared-change|sds-gap|interface-gap|environment|authority`).
 *
 * The frontend lane is three operations, never one: `interface.draw` writes the interface design record
 * (screens, every state, blueprint, contract slots, copy), `frontend.implement` may only build what that
 * record describes, and `uat.verify` walks the rendered surface. Each of those sequences says so in its
 * definition of done, so no operation of the lane can report the node finished on its own.
 *
 * The module is product-agnostic: no repository name, no product path, only what the operation carries.
 */

export const STEPS_HEADING='## Working order (mandatory, in this order)';
export const DONE_HEADING='## Definition of done for this kind';
export const SEQUENCES=['implement.ledger','implement.shared','implement.repair','implement.gate','interface.draw','frontend.implement','review.verify','e2e.verify','uat','uat.verify','operations','migration','architecture.revise','decide','generic'];

const IMPLEMENT_KINDS=['backend.implement','interface.implement','frontend.implement'];
const IMPLEMENT_NODES=['implementation','ui'];
const DECIDE_KINDS=['architecture.decide','business.decide'];
const MIGRATION=/(^|\/)migrations\//;
/** A Work node delivered by the frontend: the `implementation/frontend/**` layout, or any node path under a `frontend/` scope. */
const FRONTEND_LAYOUT=/(^|\/)implementation\/frontend(\/|$)/;
const FRONTEND_SCOPE=/(^|\/)frontend\//;
/** The lane hint every frontend kind carries in its definition of done. */
const LANE='Lane: this op is one step of `interface.draw` -> `frontend.implement` -> `uat.verify`; the node is done only after `uat.verify`.';

const nodePath=node=>{
  for(const value of [node?.inputRef,node?.path,node?.file,node?.layout]){const t=text(value).replaceAll('\\','/');if(t)return t;}
  return '';
};
const frontendNode=node=>{const at=nodePath(node);return Boolean(at)&&(FRONTEND_LAYOUT.test(at)||FRONTEND_SCOPE.test(at));};

const text=value=>String(value??'').trim();
const list=value=>Array.isArray(value)?value.map(text).filter(Boolean):[];
const code=value=>`\`${text(value)}\``;
const codes=(values,fallback)=>{const items=list(values);return items.length?items.map(code).join(', '):fallback;};
const clip=(value,max=90)=>{const t=text(value).replace(/\s+/g,' ');return t.length>max?`${t.slice(0,max-1)}…`:t;};
const count=(n,one,many=`${one}s`)=>`${n} ${n===1?one:many}`;

/** The sequence key of an operation: its kind and origin first, then the Work node kind and layout it closes, then its allowlist. */
export function sequenceFor(op,{node=null}={}){
  const kind=text(op?.kind),origin=text(op?.origin),nodeKind=text(node?.kind),allowlist=list(op?.allowlist);
  if(kind==='review.verify')return 'review.verify';
  if(kind==='interface.draw')return 'interface.draw';
  if(kind==='architecture.revise')return 'architecture.revise';
  if(DECIDE_KINDS.includes(kind))return 'decide';
  if(kind==='uat.verify')return 'uat.verify';
  // End-to-end proof of a backend slice goes through the API on a real stack, never a screen: `e2e.verify` is the
  // backend lane's prove step, and a ledger `uat` node outside the frontend layout is such a scenario.
  if(kind==='e2e.verify')return 'e2e.verify';
  if(nodeKind==='uat')return frontendNode(node)?'uat.verify':'uat';
  const implement=IMPLEMENT_KINDS.includes(kind)||IMPLEMENT_NODES.includes(nodeKind);
  if(implement&&origin==='shared')return 'implement.shared';
  if(implement&&origin==='repair')return 'implement.repair';
  if(implement&&origin==='gate')return 'implement.gate';
  // A frontend implementation node is the lane's middle step, whatever the implementing kind is called.
  if(kind==='frontend.implement'||(implement&&frontendNode(node)))return 'frontend.implement';
  if(allowlist.some(entry=>MIGRATION.test(entry)))return 'migration';
  if(kind==='runtime.operate'||nodeKind==='operations')return 'operations';
  if(implement)return 'implement.ledger';
  return 'generic';
}

/** The operation's own values, ready to be spliced into one-line steps. */
function values(op,node){
  const checks=Array.isArray(op?.checks)?op.checks.filter(check=>text(check?.command)):[];
  const findings=Array.isArray(op?.findings)?op.findings:[];
  const named=checks.map(check=>`${text(check.name)||'check'}: ${code(check.command)}`).join('; ');
  return {
    kind:text(op?.kind),
    allowlist:codes(op?.allowlist,'the allowlist above'),
    checks:checks.length?named:'the checks this code already has (none were declared; record the ones you ran)',
    declared:checks.length?named:'none were declared - record the exact commands you ran',
    checkCount:checks.length,
    acceptance:codes(list(op?.acceptance).map(item=>clip(item)),'the goal above'),
    acceptanceCount:list(op?.acceptance).length,
    references:codes(op?.references,'the goal and the allowlist above'),
    resources:codes(op?.resources,'no declared runtime'),
    requesters:codes(op?.requesters,'the operation that reported the shared change'),
    findings:count(findings.length,'finding'),
    node:node?.id??op?.nodeId??null
  };
}

const SEQUENCE_STEPS={
  'implement.ledger':v=>({
    steps:[
      `Read ${v.references} and the node assertions (${v.acceptance}); restate in three lines what must be true when you are done.`,
      `Write or extend the spec(s) that prove each of those assertions and run them: they MUST fail now (the kernel checks that they failed at the base head and pass after your change; a spec that is green before your code proves nothing).`,
      `Implement the smallest change inside the allowlist (${v.allowlist}) until those specs pass; no refactor, no drive-by edit.`,
      `Run every listed check verbatim: ${v.checks}.`,
      `Self-audit: every assertion has a passing check, \`git status\` shows no file outside the allowlist, no secret, no TODO left in what you changed.`,
      `Report \`done\` exactly once with the spec paths and the check commands. A change you need outside the allowlist: report \`blocked\` with blocker \`shared-change\` and the exact paths, never touch them. A contradictory or missing design (SDS): report \`blocked\` with blocker \`sds-gap\`, or \`ask\` with the exact gap.`
    ],
    done:[
      `every assertion (${v.acceptance}) is proven by a spec that was red before your change and is green after it`,
      `every check exits 0: ${v.checks}`,
      `only allowlisted paths changed`
    ]
  }),
  'implement.shared':v=>({
    steps:[
      `Read the request from ${v.requesters}: the exact paths (${v.allowlist}) and the behavior they need (${v.acceptance}).`,
      `Make the minimal change that gives the requester what it asked for; no refactor, no renaming, nothing the request did not name.`,
      `Run the requester's checks verbatim: ${v.checks}.`,
      `Self-audit: \`git status\` shows only ${v.allowlist}; nothing else moved.`,
      `Report \`done\` exactly once, naming what changed and why the requester can now proceed; report \`blocked\` with \`shared-change\` and the exact paths if the change needs yet another path.`
    ],
    done:[`the requested change exists on ${v.allowlist} and nothing else`,`the requester's checks exit 0`]
  }),
  'implement.repair':v=>({
    steps:[
      `Read the ${v.findings} listed under "Findings you must resolve" and map each one to the file, line and assertion it names.`,
      `For each finding, re-run the check that exposed it and confirm it fails now: ${v.checks}.`,
      `Fix each finding explicitly inside the allowlist (${v.allowlist}); do not widen the change beyond what a finding names.`,
      `Re-run every check verbatim until each exits 0: ${v.checks}.`,
      `Self-audit: every finding has a fix, \`git status\` shows no file outside the allowlist, no TODO.`,
      `Report \`done\` exactly once with a finding -> fix map in the summary; a finding you cannot resolve inside the allowlist: report \`blocked\` with \`shared-change\` and the exact paths.`
    ],
    done:[`every one of the ${v.findings} has a named fix`,`the check that exposed each finding exits 0`,`only allowlisted paths changed`]
  }),
  'implement.gate':v=>({
    steps:[
      `Read the failing gate(s) in "Findings you must resolve" (${v.findings}): the gate name, its exit code and its evidence.`,
      `Re-run the failing gate command verbatim and read the first failure: ${v.checks}.`,
      `Fix exactly what the failing gate names inside the allowlist (${v.allowlist}); nothing else.`,
      `Re-run the gate until it exits 0, then every other listed check.`,
      `Self-audit: \`git status\` shows no file outside the allowlist.`,
      `Report \`done\` exactly once naming the gate and the fix; report \`blocked\` with \`shared-change\` and the exact paths if the fix lives outside the allowlist.`
    ],
    done:[`the named gate exits 0`,`no other check regressed`,`only allowlisted paths changed`]
  }),
  'interface.draw':v=>({
    steps:[
      `Read ${v.references} - the requirement (SRS) and design (SDS) sections this interface must satisfy - and the node assertions (${v.acceptance}); name every screen this operation draws.`,
      `For each screen, enumerate every state it can be in before you draw anything (at least loading, empty, error, populated and permission-denied where the requirement allows it); a state you do not enumerate is a state nobody will build.`,
      `Draw inside the project's frontend design rules named in the references - the installed design grammar and its contract components, the blueprint vocabulary, the typed component rules; invent no component family and no token of your own.`,
      `Write the interface design record at the path the allowlist names (${v.allowlist}): per screen its blueprint (the regions in order), each enumerated state with what it shows, the contract slots each region fills and the exact copy; no product code.`,
      `Where the runtime supports rendering, produce one rendered candidate per screen state and store it in the owning node's own \`assets/\` beside the record the allowlist names (${v.allowlist}), each labelled screen + state + viewport and marked a proposed design, never a capture of a working feature.`,
      `Self-check: every assertion (${v.acceptance}) maps to a named screen state, every enumerated state has its blueprint, slots and copy, and nothing in the record rests on a business rule the references do not state.`,
      `Report \`done\` exactly once with the record path(s) and the rendered candidates; a business rule the references do not settle is \`blocked\` with blocker \`sds-gap\` and the exact question, never a guess, and a change outside the allowlist is \`blocked\` with \`shared-change\` and the exact paths.`
    ],
    done:[
      `the record at ${v.allowlist} names every screen and every enumerated state (loading, empty, error, populated, permission-denied where it applies)`,
      `every assertion (${v.acceptance}) maps to one screen state, with a rendered candidate per state wherever the runtime can render`,
      `no product code changed; the drawing stays inside the installed design grammar`,
      LANE
    ]
  }),
  'frontend.implement':v=>({
    steps:[
      `Read the interface design record named in ${v.references} first - its screens, their enumerated states, blueprints, contract slots and copy; a screen or state the record does not contain is not yours to invent: report \`blocked\` with blocker \`interface-gap\` naming the missing screen and state instead of improvising a layout.`,
      `Write the failing story/spec per screen state in the record and run them: they MUST fail now (the kernel checks that they failed at the base head and pass after your change; a story that is green before your code proves nothing).`,
      `Implement inside the allowlist (${v.allowlist}) with the typed components of the installed design grammar only - no untyped children, no new component family, no ad-hoc token, no screen the record does not describe.`,
      `Update the stories and the skeleton of every layout you changed, so each state stays renderable on its own (a layout change without its story and skeleton is an unfinished change).`,
      `Run every listed check verbatim: ${v.checks}.`,
      `Self-audit: every state of the record has a passing story/spec, \`git status\` shows no file outside the allowlist, no TODO, and no screen exists that the record does not describe.`,
      `Report \`done\` exactly once with the story/spec paths and the check commands; \`blocked\` \`interface-gap\` for a screen or state the record lacks, \`blocked\` \`shared-change\` with the exact paths outside the allowlist, \`blocked\` \`sds-gap\` for a missing business rule.`
    ],
    done:[
      `every screen state of the interface design record has a story/spec that was red before your change and is green after it`,
      `stories and skeletons match the layout you shipped, and every state renders in isolation`,
      `every check exits 0: ${v.checks}`,
      `only allowlisted paths changed and no screen was invented beyond the record`,
      LANE
    ]
  }),
  'review.verify':v=>({
    steps:[
      `Read ${v.references} and the assertions under review (${v.acceptance}); the code under ${v.allowlist} is what you review, and this operation is read-only: change no product file.`,
      `Run every check of the group yourself, verbatim: ${v.checks}; record each exit code.`,
      `Compare the implemented behavior against each assertion and the design (SDS) it references; read the code and the specs, not the previous report.`,
      `Write each finding as file + line + the assertion it breaks; a finding without a file and line is not a finding.`,
      `Never fix anything: a repair is a separate operation the kernel creates from your findings.`,
      `Report \`done\` exactly once with the findings in \`open[]\` (empty when the group is clean) and the checks file; report \`failed\` only when a check could not run at all.`
    ],
    done:[`every check ran and its exit code is recorded`,`every assertion was compared against the code`,`findings name file, line and assertion; no product file changed`]
  }),
  'e2e.verify':v=>({
    steps:[
      `Read the design (SDS) and requirement (SRS) material in ${v.references} and the node assertions (${v.acceptance}); restate, per assertion, the request a client sends and the observable effect the stack must show.`,
      `Write or extend the end-to-end spec at the path the allowlist names (${v.allowlist}): one scenario per assertion, exercised through the public API on the real stack (database, identity, containers) with no mock of the unit under proof; never through a screen.`,
      `Start only the end-to-end runtime named in resources (${v.resources}) and seed it as the scenario needs; touch no other runtime and change no product code - a behavior that is wrong is a finding to report, not a fix to make here.`,
      `Run the listed check verbatim (${v.checks}) and keep the run output; a scenario that passes without the stack running proves nothing and is a defect of the spec.`,
      `Self-audit: every assertion has a scenario, every scenario ran on ${v.resources}, and \`git status\` shows only ${v.allowlist}.`,
      `Report \`done\` exactly once with the run output in the summary and the spec paths; a failing scenario is \`failed\` naming the assertion and the observed response; a runtime that cannot start is \`failed\` with the exact reason (\`blocked\` \`environment\` only when it provably cannot be fixed from the allowlist); never \`done\` on an unrun or partial spec.`
    ],
    done:[
      `the spec at ${v.allowlist} exercises every assertion (${v.acceptance}) through the API on the real stack`,
      `it ran on ${v.resources} and its output is in the report`,
      `a failing scenario or a runtime that did not start is \`failed\`, never a \`done\``,
      'Lane: this op is the prove step of `backend.implement` -> `e2e.verify` -> `review.verify`; the node is done only after `review.verify` accepts the slice this spec proved.'
    ]
  }),
  uat:v=>({
    steps:[
      `Read the flow folder named in ${v.references}: the flow, its seed and its accounts; restate the steps a user takes and what each step must show.`,
      `Write the end-to-end spec at the path the allowlist names (${v.allowlist}), one step of the flow per assertion (${v.acceptance}).`,
      `Start the end-to-end runtime named in resources (${v.resources}) and seed it as the flow says; touch no other runtime.`,
      `Run the spec on that runtime: ${v.checks}; keep the run output.`,
      `Self-audit: every flow step has an assertion, the spec ran against the named runtime, \`git status\` shows no file outside the allowlist.`,
      `Report \`done\` exactly once with the run output in the summary. If the runtime cannot start or the flow cannot be seeded, report \`failed\` with the exact reason; never \`done\` on an unrun spec.`
    ],
    done:[`the spec at ${v.allowlist} covers every flow step`,`it ran on ${v.resources} and its output is in the report`,`a runtime that did not start is a \`failed\`, never a \`done\``]
  }),
  'uat.verify':v=>({
    steps:[
      `Read the flow folder named in ${v.references}: the flow steps, its seed and its accounts; restate each step and what the rendered surface must show when it is done.`,
      `Start the runtime named in resources (${v.resources}) and seed it exactly as the flow says, with the commands the flow declares (${v.declared}); touch no other runtime and change no product code.`,
      `Walk the flow on the rendered surface the way a person does - open the page, click, type, read what is on screen - and never through the API: a step proven by a request or a mutation is not walked, and it is a finding against you.`,
      `Capture a screenshot at every step and keep it with that step; a step without a capture did not happen.`,
      `Compare each step against the interface design record and the node assertions (${v.acceptance}): the state shown, the copy, the order of the blueprint; a difference is that step failing, not a note for later.`,
      `Write the run record under the flow folder at the path the allowlist names (${v.allowlist}): per step what you did, what you saw, its screenshot and its verdict, plus the heads and the seed you ran against.`,
      `Report \`done\` exactly once and only when every step of the walk passed; a step that failed is \`failed\` naming the step, what you saw instead and its screenshot; a runtime that cannot start is \`failed\` with the exact reason (an environment you cannot fix is \`blocked\` with \`environment\`); a walk that stopped early is \`partial\` or \`failed\`, never \`done\`.`
    ],
    done:[
      `every flow step was walked on the rendered surface, never through the API, and every step has a screenshot`,
      `the run record at ${v.allowlist} carries each step's verdict against the interface design record and the assertions (${v.acceptance})`,
      `a partial walk, a failed step or a runtime that did not start is \`partial\`/\`failed\`, never a \`done\``,
      LANE
    ]
  }),
  'architecture.revise':v=>({
    steps:[
      `Read the gap report that opened this operation (${v.findings}) and ${v.references}: the exact design (SDS) section it names and the behavior the implementation could not derive from it.`,
      `Edit only that section inside the allowlist (${v.allowlist}): state the behavior, its contract and its acceptance so an implementer derives the code from the text alone; touch no other section and no code file.`,
      `Bump that section's \`rev\` and append one decision-log entry - what changed, why, and which gap report asked for it; never rewrite or delete an earlier entry.`,
      `Run the listed validator check verbatim: ${v.declared}.`,
      `Self-audit: the gap is answered in the text, \`rev\` is higher than it was, the log has exactly one new entry, and \`git status\` shows only ${v.allowlist} - no product code.`,
      `Report \`done\` exactly once with the new \`rev\` and the sections you changed; a gap that needs a product decision rather than a design edit is \`ask\` with the exact question (or \`blocked\` \`sds-gap\` when the requirement itself is missing), never a silent invention.`
    ],
    done:[
      `the named gap is answered in ${v.allowlist}, its \`rev\` is bumped and the decision log has one new entry`,
      `the validator check exits 0: ${v.declared}`,
      `no product code changed and no other design section moved`
    ]
  }),
  operations:v=>({
    steps:[
      `Read ${v.references} and the assertions (${v.acceptance}); name the runtime state before and after.`,
      `Write the change inside the allowlist (${v.allowlist}); never edit an already-committed migration or an already-applied operation.`,
      `Apply it on a real database or service container (${v.resources}) and record the output.`,
      `Roll it back on the same container and prove the rollback leaves the prior state; then apply again to prove idempotence.`,
      `Run every listed check verbatim: ${v.checks}.`,
      `Self-audit: apply, rollback and re-apply outputs are recorded, no secret in any file, \`git status\` shows no file outside the allowlist.`,
      `Report \`done\` exactly once with the apply/rollback/re-apply outputs; a container that cannot start is a \`failed\` with the exact reason, an environment you cannot fix is \`blocked\` with \`environment\`.`
    ],
    done:[`apply, rollback and re-apply all succeeded on ${v.resources}`,`every check exits 0`,`no committed migration was edited`]
  }),
  migration:v=>({
    steps:[
      `Read ${v.references} and the assertions (${v.acceptance}); name the schema before and after.`,
      `Write a NEW migration inside the allowlist (${v.allowlist}); never edit an already-committed migration - a correction is another migration.`,
      `Apply it on a real database container (${v.resources}) and record the output.`,
      `Roll it back on the same container and prove the schema returns to the prior state; then apply again to prove idempotence.`,
      `Run every listed check verbatim: ${v.checks}.`,
      `Self-audit: apply, rollback and re-apply outputs are recorded, no data-destroying statement without the design saying so, \`git status\` shows no file outside the allowlist.`,
      `Report \`done\` exactly once with the apply/rollback/re-apply outputs; a container that cannot start is a \`failed\` with the exact reason.`
    ],
    done:[`the migration applies, rolls back and re-applies on ${v.resources}`,`every check exits 0`,`no committed migration was edited`]
  }),
  decide:v=>{
    // The two decision kinds answer different questions and own different records; the steps say which.
    const business=v.kind==='business.decide';
    const frame=business
      ?'a business decision - what the product must do, written as requirement, rule or journey'
      :'a design decision - how the system satisfies an accepted requirement, written as component, contract or mechanism';
    const against=business
      ?'the requirement it states and the journeys and rules it changes'
      :'the requirement (SRS) it must satisfy and the rest of the design (SDS) it must stay consistent with';
    const forbidden=business
      ?'no component, contract, schema or technology choice - that is an `architecture.decide`'
      :'no new product rule, price or policy - that is a `business.decide`';
    return {
      steps:[
        `Read ${v.references} and the closed options the node offers; this is ${frame}, and the decision is among those options only.`,
        `Weigh each option against the assertions (${v.acceptance}) and ${against}; write the trade-off in one line per option.`,
        `Choose one option and write the decision with its rationale into the node file the allowlist names (${v.allowlist}); no code, no other file, and ${forbidden}.`,
        `Self-audit: the chosen option is one of the offered ones, the rationale names why the others lose, \`git status\` shows only ${v.allowlist}.`,
        `Report \`done\` exactly once with the chosen option; when no offered option satisfies the assertions, report \`ask\` with the options and what each lacks, never invent a new one silently.`
      ],
      done:[`the node records one chosen option with a rationale`,`the decision stays inside its own layer: ${forbidden}`,`no code changed`]
    };
  },
  generic:v=>({
    steps:[
      `Read ${v.references} and the acceptance (${v.acceptance}); restate in three lines what must be true when you are done.`,
      `Write or extend the spec(s) that prove it and run them: they MUST fail now.`,
      `Make the smallest change inside the allowlist (${v.allowlist}) until they pass.`,
      `Run every listed check verbatim: ${v.checks}.`,
      `Self-audit: every acceptance item has a passing check, \`git status\` shows no file outside the allowlist, no secret, no TODO.`,
      `Report \`done\` exactly once with the spec paths and the check commands; \`blocked\` with \`shared-change\` and the exact paths for anything outside the allowlist.`
    ],
    done:[`every acceptance item is proven by a check that was red before and is green after`,`every check exits 0`,`only allowlisted paths changed`]
  })
};

/** The two markdown sections for the contract: the numbered working order and the definition of done of this kind. */
export function stepsFor(op,{node=null}={}){
  const sequence=sequenceFor(op,{node});
  const {steps,done}=SEQUENCE_STEPS[sequence](values(op,node));
  return [
    `${STEPS_HEADING}`,
    `Sequence \`${sequence}\`. Do these in order; skipping or reordering a step is a finding at review.`,
    ...steps.map((step,index)=>`${index+1}. ${step}`),
    ``,
    DONE_HEADING,
    ...done.map(item=>`- ${item}`)
  ].join('\n');
}
