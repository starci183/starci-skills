// Op identity for the UI: Vietnamese name + goal, inputs, outputs and side effects of one op,
// read-only from modules/ops/ops/<op>.yaml (cached by mtime) and the contract op labels.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { mergeOpShared, opSharedOf } from '../../scripts/lib/op-shared.mjs';
import { opLabelMap } from '../../scripts/lib/display-names.mjs';
import { translator } from '../../scripts/lib/i18n.mjs';

const OPS_DIR = new URL('../../modules/ops/ops/', import.meta.url);
const tr = translator('vi');

/** One-line English summaries, written from each op's yaml goal; the owner reads their Vietnamese through the i18n catalog. */
const GOAL_EN = {
  'request.analyze': 'Reads the owner\'s request, picks the matching workflow and writes a scope summary — nothing real is done yet.',
  'task.execute': 'Analyzes a request and picks an evidence-based workflow, with no side effects.',
  'scope.define': 'Turns the request into a bounded scope: what may be touched, dependencies and exclusions. Analysis only; nothing written beyond records.',
  'scope.finish': 'Closes out a scope (end of lifecycle), keeps the needed evidence and does not break what is in use.',
  'business.decide': 'Settles the business behaviour of the work: enough to build and for an independent party to accept, then refined from feedback.',
  'architecture.decide': 'Designs the minimal architecture still enough to build the work safely, then adjusted from evidence during implementation.',
  'brand.decide': 'Settles the product\'s visual identity: colours, type, logo, icons, voice and frame layout.',
  'interface.draw': 'Draws the interface direction with real components before coding: picks the main screens and builds each state.',
  'interface.asset': 'Creates the artwork the approved interface needs, stored as real files in the repo.',
  'interface.scaffold': 'Scaffolds the new interface code and proves it runs (green build, first screenshot).',
  'interface.implement': 'Builds the chosen interface per the drawings, business rules and architecture, then verifies the real rendering.',
  'interface.audit': 'Checks the real interface against the owner-approved drawings and produces a reproducible defect list.',
  'provision.ask': 'Asks the owner for exactly the one thing only they can give: an access key, account, data, decision or permission.',
  'work.author': 'Writes the Work record for one part: the write scope, proof requirements and a check command per requirement.',
  'backend.implement': 'Builds one chosen backend result and proves its contract with real code.',
  'backend.scaffold': 'Scaffolds new backend code in the repo and proves its build tooling runs.',
  'package.scaffold': 'Scaffolds a new package/library and proves the consumer can import it.',
  'integration.verify': 'Verifies an external integration against the real provider (a test environment), keeping the exchange as evidence.',
  'uat.verify': 'Runs the user flows in order with real screenshots/video, then cleans up.',
  'uat.assisted.prepare': 'Prepares an assisted UAT run with steps needing a real person, frozen so it cannot be edited later.',
  'uat.assisted.verify': 'Re-checks an assisted UAT run from its receipt: evidence, data, cleanup — "the person clicked through" is not acceptance.',
  'e2e.verify': 'Proves the delivered part through the public API on the real system (manual only, when the owner asks).',
  'perf.verify': 'Measures real performance on the running product and keeps the numbers as evidence; the product is not changed.',
  'security.verify': 'Audits code and configuration security (read-only), records evidence-backed findings, never self-fixes.',
  'review.verify': 'Independently checks the delivered result (business logic, interface, API…) without fixing it for the builders.',
  'handover.review': 'Hands over to the owner: what was done, how it was tested, what is missing, what risks — then asks for approval.',
  'code.refactor': 'Restructures one part of the code while keeping its behaviour, proven by the same test before and after.',
  'test.author': 'Writes the test files for one part and proves a real test runner accepts them.',
  'docs.author': 'Writes documentation for the chosen scope from the settled records and the real code.',
  'content.generate': 'Creates or fixes one content unit, with grounded claims and media/code checks.',
  'decision.prepare': 'Prepares a draft decision: the question, the options, a recommendation — the owner may overturn it.',
  'goal.revise': 'Creates a new goal revision from the old goal and the requested change, with a clear diff and no self-granted scope.',
  'release.deliver': 'Releases, deploys or runs the chosen database migration, then verifies the result remotely.',
  'runtime.operate': 'Brings a running service/environment to the required state, with evidence afterwards.',
  'workspace.manage': 'Creates or rebuilds a .starciwork workspace with verified links and preserved provenance.',
  'knowledge.repair': 'Fixes an incorrectly prepared rule/guideline and its related references from applied evidence.',
  'grammar.update': 'Adds a unit to the design component system when the product needs one it lacks.',
};

const cache = new Map();
const text = (value) => typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim() : null;
const en = (value) => text(value?.en) ?? text(value);

function read(op) {
  const file = new URL(`${encodeURIComponent(op)}.yaml`, OPS_DIR);
  let mtime;
  try { mtime = fs.statSync(file).mtimeMs; } catch { return null; }
  const hit = cache.get(op);
  if (hit && hit.mtime === mtime) return hit.doc;
  let doc = null;
  try {
    // `shared:` markers expand to the _common.yaml fragments (scripts/lib/op-shared.mjs).
    doc = mergeOpShared(parseYaml(fs.readFileSync(file, 'utf8')), opSharedOf(fileURLToPath(file)));
  } catch { doc = null; }
  cache.set(op, { mtime, doc });
  return doc;
}

/** OpInfo for one op id (a `op#instance` label reads as its op). Never throws. */
export function opInfo(op, manifest = null) {
  const id = String(op ?? '').split('#')[0];
  const label = opLabelMap()[id] ?? null;
  const doc = read(id);
  const asList = (value) => Array.isArray(value) ? value : [];
  const goalEn = en(doc?.goal);
  return {
    op, nameVi: text(label?.vi), nameEn: text(label?.en),
    goal: { en: goalEn, vi: GOAL_EN[id] ? tr(GOAL_EN[id]) : null },
    reads: asList(doc?.reads).map(r => ({ id: String(r?.id ?? ''), purpose: en(r?.purpose) })).filter(r => r.id),
    writes: asList(doc?.writes).map(w => [w?.id, w?.path].filter(Boolean).join(' — ')).filter(Boolean),
    sideEffects: asList(doc?.sideEffects).map(text).filter(Boolean),
    manifest,
  };
}
