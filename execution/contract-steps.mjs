/**
 * Kind-specific working order for an operation contract (5.0).
 *
 * The kernel keeps every bit of process authority - which operation runs, in what order, what is accepted -
 * and the Work ledger decides the order of operations. What an agent lacked was the order of work INSIDE one
 * operation: some wrote a green spec first, some skipped the design, some edited outside their allowlist.
 * `stepsFor` renders a mandatory, numbered sequence per operation kind, interpolated from the operation's own
 * values (allowlist, checks, acceptance, references, resources, requesters, findings), so the contract tells
 * the agent what to do first, what must be red before code, and how to report exactly once with the real
 * report vocabulary (`done|partial|failed|ask|blocked`; blockers `shared-change|sds-gap|environment|authority`).
 *
 * The module is product-agnostic: no repository name, no product path, only what the operation carries.
 */

export const STEPS_HEADING='## Working order (mandatory, in this order)';
export const DONE_HEADING='## Definition of done for this kind';
export const SEQUENCES=['implement.ledger','implement.shared','implement.repair','implement.gate','review.verify','uat','operations','migration','decide','generic'];

const IMPLEMENT_KINDS=['backend.implement','interface.implement'];
const IMPLEMENT_NODES=['implementation','ui'];
const DECIDE_KINDS=['architecture.decide','business.decide'];
const MIGRATION=/(^|\/)migrations\//;

const text=value=>String(value??'').trim();
const list=value=>Array.isArray(value)?value.map(text).filter(Boolean):[];
const code=value=>`\`${text(value)}\``;
const codes=(values,fallback)=>{const items=list(values);return items.length?items.map(code).join(', '):fallback;};
const clip=(value,max=90)=>{const t=text(value).replace(/\s+/g,' ');return t.length>max?`${t.slice(0,max-1)}…`:t;};
const count=(n,one,many=`${one}s`)=>`${n} ${n===1?one:many}`;

/** The sequence key of an operation: its kind and origin first, then the Work node kind it closes, then its allowlist. */
export function sequenceFor(op,{node=null}={}){
  const kind=text(op?.kind),origin=text(op?.origin),nodeKind=text(node?.kind),allowlist=list(op?.allowlist);
  if(kind==='review.verify')return 'review.verify';
  if(DECIDE_KINDS.includes(kind))return 'decide';
  if(kind==='uat.verify'||nodeKind==='uat')return 'uat';
  const implement=IMPLEMENT_KINDS.includes(kind)||IMPLEMENT_NODES.includes(nodeKind);
  if(implement&&origin==='shared')return 'implement.shared';
  if(implement&&origin==='repair')return 'implement.repair';
  if(implement&&origin==='gate')return 'implement.gate';
  if(allowlist.some(entry=>MIGRATION.test(entry)))return 'migration';
  if(kind==='runtime.operate'||nodeKind==='operations')return 'operations';
  if(implement)return 'implement.ledger';
  return 'generic';
}

/** The operation's own values, ready to be spliced into one-line steps. */
function values(op,node){
  const checks=Array.isArray(op?.checks)?op.checks.filter(check=>text(check?.command)):[];
  const findings=Array.isArray(op?.findings)?op.findings:[];
  return {
    allowlist:codes(op?.allowlist,'the allowlist above'),
    checks:checks.length?checks.map(check=>`${text(check.name)||'check'}: ${code(check.command)}`).join('; '):'the checks this code already has (none were declared; record the ones you ran)',
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
  decide:v=>({
    steps:[
      `Read ${v.references} and the closed options the node offers; the decision is among those options only.`,
      `Weigh each option against the assertions (${v.acceptance}) and the design it must satisfy; write the trade-off in one line per option.`,
      `Choose one option and write the decision with its rationale into the node file the allowlist names (${v.allowlist}); no code, no other file.`,
      `Self-audit: the chosen option is one of the offered ones, the rationale names why the others lose, \`git status\` shows only ${v.allowlist}.`,
      `Report \`done\` exactly once with the chosen option; when no offered option satisfies the assertions, report \`ask\` with the options and what each lacks, never invent a new one silently.`
    ],
    done:[`the node records one chosen option with a rationale`,`no code changed`]
  }),
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
