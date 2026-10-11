// walk-standins.mjs - the scripted op of the workflow walk: what a correct op does for each op kind, derived from the op's contract (modules/ops/ops/<op>.yaml) and the packet
// the dispatch wrote. Each stand-in returns the report envelope and the files to attach; it writes the lawful product into the workflow tree and runs the commands the packet
// names (starci gate read, starci runtime validate, starci work graph propose) through the real CLI.
import fs from 'node:fs';
import path from 'node:path';
import { FEATURE, scratchOf } from './walk-world.mjs';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { RESOURCE_RECORDS, recordsOf } from './walk-records.mjs';

export const WORK = '.starciwork';
const readOp = (root, op) => parseYaml(fs.readFileSync(path.join(root, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'));
export const put = (tree, rel, text) => { fs.mkdirSync(path.dirname(path.join(tree, rel)), { recursive: true }); fs.writeFileSync(path.join(tree, rel), text); return rel; };
const yamlOf = (lines) => `${lines.join('\n')}\n`;

/** The knowledge files the op's `standard` read cites (the READ digest names them). */
export function knowledgeOf(root, op) {
  const read = (readOp(root, op).reads ?? []).find((r) => r.id === 'standard');
  const text = `${read?.path ?? ''}`;
  return [...new Set([...text.matchAll(/knowledge\/[\w./-]+\.yaml/g)].map((m) => m[0]))];
}

/** The READ of the standard the contract orders: the digest in the scratch (attached) and the same command, re-runnable, in report.checks. */
export function readCheck({ walk, jobId, op, touches }) {
  const { world, tree } = walk;
  const out = path.join(scratchOf(world, jobId), 'read-digest.json');
  const knowledge = knowledgeOf(walk.ROOT, op);
  const args = ['gate', 'read', '--root', tree, ...touches.flatMap((f) => ['--touch', f]), ...knowledge.flatMap((f) => ['--knowledge', f]), '--out', out];
  const r = walk.sh(args, { jobId });
  return { result: r, attach: out, check: { name: 'starci-read-digest', command: `starci ${args.join(' ')}`, exitCode: r.status ?? 1, phase: 'verify', evidence: 'READ digest' } };
}

/** The record validator of the contract, over the real tree path. */
export const validateCheck = (walk, owned, jobId) => {
  const r = walk.sh(['runtime', 'validate', WORK, ...(owned ? ['--owned', owned.join(',')] : [])], { jobId });
  return { result: r, check: { name: 'starci-validate', command: `starci runtime validate ${WORK} --json${owned ? ` --owned ${owned.join(',')}` : ''}`, exitCode: r.status ?? 1, phase: 'verify', evidence: 'work records valid' } };
};

const SCOPE = {
  request: { workflow: 'wf-walk', goalIdentity: 'goal-1', goalRevision: 0, outcome: 'A person signs up, signs in and keeps a session.', effectCeiling: 'Records and source in the workflow tree only.' },
  nodes: [{ id: 'identity.foundation', kind: 'foundation', purpose: 'The account table and the session store.', grounding: ['owner-approved-goal'] },
    { id: 'identity.sign-in', kind: 'slice', purpose: 'A person signs in with an email and a password.', grounding: ['owner-approved-goal'], dependsOn: ['identity.foundation'] }],
  deps: [{ from: 'identity.sign-in', to: 'identity.foundation', reason: 'Sign-in reads the account the foundation stores.' }],
  exclusions: [{ subject: 'Deployment', reason: 'The goal grants no deployment effect.' }],
  openQuestions: [],
};
const GRAPH = (workflow) => ({ schema: 'starci/work-graph@1', workflow, domains: [{ id: FEATURE }],
  nodes: [{ id: 'identity.foundation', domain: FEATURE, slice: 'identity.foundation', kind: 'foundation', title: 'Account and session store', ownedPaths: ['be/src/identity/foundation'], reads: [], rollbackTo: 'identity.foundation', size: { files: 3, records: 1 }, frs: ['fr.identity.account'] },
    { id: 'identity.sign-in', domain: FEATURE, slice: 'identity.sign-in', kind: 'slice', title: 'Sign in', ownedPaths: ['be/src/identity/sign-in', 'fe/src/identity/sign-in'], reads: ['be/src/identity/foundation'], rollbackTo: 'identity.sign-in', size: { files: 4, records: 2 }, frs: ['fr.identity.sign-in'] }],
  edges: [{ from: 'identity.foundation', to: 'identity.sign-in', kind: 'order' }] });

/** Proposes the work graph through the real verb, as the op's contract says (work graph v0 / revision). */
export function proposeGraph({ walk, jobId, graph, reason }) {
  const file = path.join(scratchOf(walk.world, jobId), 'graph-candidate.json');
  fs.writeFileSync(file, JSON.stringify(graph));
  return walk.sh(['work', 'graph', 'propose', '--repo', walk.world.repo, '--workflow', walk.world.wf, '--job', jobId, '--file', file, '--reason', reason], { jobId });
}

/** Writes the records of the families into the tree and answers their paths. */
export function writeFamilies(walk, families) {
  return Object.entries(recordsOf(families)).map(([rel, text]) => put(walk.tree, `${WORK}/features/${FEATURE}/${rel}`, text));
}

/** The owned paths a correct Kernel grants each op: the feature's families the contract writes (modules/ops/ops/<op>.yaml writes). */
export const LEG_PATHS = {
  'scope.define': [`${WORK}/features/${FEATURE}`, `${WORK}/index.yaml`],
  'business.decide': ['fr', 'nfr', 'br', 'decision', 'data', 'journey'].map((f) => `${WORK}/features/${FEATURE}/${f}`).concat(`${WORK}/features/${FEATURE}/index.yaml`),
  'architecture.decide': ['sds', 'contract', 'integration'].map((f) => `${WORK}/features/${FEATURE}/${f}`),
  'work.author': [`${WORK}/features/${FEATURE}/impl`, `${WORK}/features/${FEATURE}/uat`, `${WORK}/_resources/identities`],
};

/** An authoring op whose product is families of the example feature: its READ, its records, its validator. */
function familyStandIn(op, families, summary) {
  return ({ walk, jobId }) => {
    const files = writeFamilies(walk, families);
    const read = readCheck({ walk, jobId, op, touches: files });
    const validate = validateCheck(walk, null, jobId);
    return { report: envelope(op, summary, files, [read.check, validate.check]), attach: [read.attach], steps: { read: read.result, validate: validate.result } };
  };
}

const envelope = (op, summary, files, checks, extra = {}) => ({ schema: 'starci/op-report@1', outcome: 'done', summary, files, checks, ...extra });

/** work.author: the planned implementation record and the uat flow with its resources, the READ, the document gate. */
function workAuthor({ walk, jobId }) {
  const files = [...writeFamilies(walk, ['impl', 'uat']), ...Object.entries(RESOURCE_RECORDS).map(([rel, text]) => put(walk.tree, `${WORK}/${rel}`, text))];
  const read = readCheck({ walk, jobId, op: 'work.author', touches: files });
  const docOut = path.join(scratchOf(walk.world, jobId), 'doc-gate.json');
  const docArgs = ['gate', 'run', '--scope', 'docs', '--tree', WORK, '--out', docOut];
  const doc = walk.sh(docArgs, { jobId });
  const validate = validateCheck(walk, null, jobId);
  const checks = [read.check, { name: 'starci-doc-gate', command: `starci ${docArgs.join(' ')}`, exitCode: doc.status ?? 1, phase: 'verify', evidence: 'document gate' }, validate.check];
  return { report: envelope('work.author', 'The sign-in implementation and its uat flow authored in planned mode.', files, checks), attach: [read.attach, docOut], steps: { read: read.result, doc, validate: validate.result } };
}

export const STANDINS = {
  'work.author': workAuthor,
  'business.decide': familyStandIn('business.decide', ['fr', 'br'], 'Business rules and requirements decided.'),
  'architecture.decide': familyStandIn('architecture.decide', ['sds', 'contract', 'integration'], 'Contracts and integrations decided.'),
  'scope.define'({ walk, jobId }) {
    const files = produceScope(walk);
    const graph = proposeGraph({ walk, jobId, graph: GRAPH(walk.world.wf), reason: 'work graph v0' });
    const read = readCheck({ walk, jobId, op: 'scope.define', touches: files });
    const validate = validateCheck(walk, null, jobId);
    return { report: envelope('scope.define', 'Scope bounded: two nodes, one dependency, one exclusion.', files, [read.check, validate.check]), attach: [read.attach], steps: { graph, read: read.result, validate: validate.result } };
  },
};

/** The catalog entry of the feature the request introduces, added to the scaffold's catalog (its other entries stay). */
function addCatalogEntry(tree) {
  const rel = `${WORK}/index.yaml`;
  const catalog = parseYaml(fs.readFileSync(path.join(tree, rel), 'utf8'));
  if (!catalog.features.some((f) => f.id === FEATURE)) catalog.features.push({ id: FEATURE, directory: `features/${FEATURE}`, description: 'Sign-up, sign-in and the session.' });
  return put(tree, rel, stringifyYaml(catalog));
}

/** The records scope.define writes: the feature with its bounded scope and the catalog entry. */
export function produceScope(walk) {
  const feature = `${WORK}/features/${FEATURE}/index.yaml`;
  return [put(walk.tree, feature, yamlOf(['schema: work/feature@1', `id: ${FEATURE}`, 'title: A person signs up, signs in and keeps a session.', 'description: Account, sign-in and the session every other service verifies against.',
    'extensions:', '  work3:', '    scope:', ...JSON.stringify(SCOPE, null, 2).split(NL).map((line) => `      ${line}`)])),
  addCatalogEntry(walk.tree)];
}

export const GRAPH_V0 = GRAPH;

const BRAND = ['schema: work/brand@1', 'id: brand', 'kind: brand', 'state: done', 'rev: 1', 'brand:', '  identity:', '    name: Acme', '    family: heroui',
  '  sources:', '    - path: fe/apps/web/src/app/globals.css', '  color:', '    primary: "#0D9488"', '    surface: "#FFFFFF"', '  typography:', '    sans: Inter', '  mascot:', '    name: none', '  imagery:', '    auth: split-screen',
  '  forbidden:', '    - Never ship text on the primary colour below a 4.5 to 1 contrast ratio.', 'review:', '  reviewer: brand owner', '  authority: Owner settled rev 1.', '  reviewedAt: 2026-10-09T10:00:00.000Z', ''].join('\n');

const NL = String.fromCharCode(10);
const SHELL_EVIDENCE = ['schema: work/evidence@1', 'record: shell', 'outcome: pass', 'assertions:', '  - id: shell#conformance', '    command: starci work shell-conformance .starciwork/shell/index.yaml', '    exit: 0', '    outcome: pass',
  '    observation: The layout tree is done, every visible layout has a slot-measured capture at desktop and mobile, and the lockup is a cropped render.', 'provenance:', '  actor: brand.decide', ''].join(NL);

const PNG = async (walk, dir) => {
  const { blankImage, drawOver, encodePng } = await import('../../scripts/work/png.mjs');
  const capture = (w, h, slot) => { const image = blankImage(w, h, [30, 60, 90, 255]); drawOver(image, blankImage(slot.width, slot.height, [255, 0, 255, 255]), slot.x, slot.y); return encodePng(image); };
  fs.mkdirSync(dir, { recursive: true });
  const files = { desktop: path.join(dir, 'web--locale--desktop--light.png'), mobile: path.join(dir, 'web--locale--mobile--light.png') };
  fs.writeFileSync(files.desktop, capture(1440, 900, { x: 240, y: 64, width: 1200, height: 836 }));
  fs.writeFileSync(files.mobile, capture(390, 844, { x: 0, y: 56, width: 390, height: 788 }));
  return files;
};

/** The brand record and the settled layout tree of the shell (scan, capture each visible layout at each breakpoint, crop the lockup, persona, settle), through the real verbs. */
export async function produceBrand(walk, { scratch, jobId = null }) {
  const sh = (args) => walk.sh(args, { jobId });
  const steps = { scan: sh(['work', 'layout-tree', 'scan', '--work', WORK, '--write']) };
  const files = await PNG(walk, path.join(scratch, 'captures', 'layouts'));
  for (const bp of ['desktop', 'mobile']) steps[`capture-${bp}`] = sh(['work', 'layout-tree', 'capture', '--work', WORK, '--node', '/[locale]', '--breakpoint', bp, '--theme', 'light', '--file', files[bp], '--write']);
  steps.lockup = sh(['work', 'layout-tree', 'lockup', '--work', WORK, '--from', 'shell/assets/layouts/web--locale--desktop--light.png', '--rect', '10,10,100,30', '--write']);
  const shellFile = path.join(walk.tree, WORK, 'shell', 'index.yaml');
  let shell = fs.readFileSync(shellFile, 'utf8').replace(/^state: todo/m, 'state: done').replace(/(layout:\n\s+component: AppLayout\n\s+chrome: visible\n\s+state: )todo/, '$1done');
  const persona = ['personas:', '  - role: owner', '    default: true', '    workspace: Acme', '    user: An Nguyen', '    currency: VND', '    dateFormat: dd/MM/yyyy', 'themes:'].join(NL);
  if (!/^personas:/m.test(shell)) shell = shell.replace(/^themes:/m, persona);
  fs.writeFileSync(shellFile, shell);
  const brand = put(walk.tree, `${WORK}/brand/index.yaml`, BRAND);
  const shellEvidence = put(walk.tree, `${WORK}/shell/evidence.yaml`, SHELL_EVIDENCE);
  return { steps, files, written: [brand, `${WORK}/shell/index.yaml`, shellEvidence], brand };
}

STANDINS['brand.decide'] = async ({ walk, jobId }) => {
  const scratch = scratchOf(walk.world, jobId);
  const made = await produceBrand(walk, { scratch, jobId });
  const conformance = walk.sh(['work', 'shell-conformance', `${WORK}/shell/index.yaml`], { jobId });
  const conformanceFile = path.join(scratch, 'shell-conformance.txt');
  fs.writeFileSync(conformanceFile, `${conformance.stdout}
`);
  const brandCheck = walk.sh(['work', 'brand', WORK], { jobId });
  const read = readCheck({ walk, jobId, op: 'brand.decide', touches: [made.brand, `${WORK}/shell/index.yaml`] });
  const validate = validateCheck(walk, null, jobId);
  const checks = [read.check, validate.check, { name: 'shell-conformance', command: `starci work shell-conformance ${WORK}/shell/index.yaml`, exitCode: conformance.status ?? 1, phase: 'verify', evidence: 'layout tree settled' },
    { name: 'brand-checks', command: `starci work brand ${WORK}`, exitCode: brandCheck.status ?? 1, phase: 'verify', evidence: 'brand checks' }];
  return { report: envelope('brand.decide', 'Brand rev 1 settled; shell layout tree captured and conformant.', made.written, checks), attach: [read.attach, conformanceFile, ...Object.values(made.files)],
    steps: { ...made.steps, conformance, brandCheck, read: read.result, validate: validate.result } };
};
LEG_PATHS['brand.decide'] = [`${WORK}/brand`, `${WORK}/shell`];

const SERVICE = ['import { Injectable } from "@nestjs/common";', '', '@Injectable()', 'export class AccountService {', '  /** True when the pair is a known one. */', '  public isKnownPair(email: string, password: string): boolean {', '    return email.length > 0 && password.length >= 8;', '  }', '}', ''].join(NL);
const SERVICE_SPEC = ['import { AccountService } from "./account.service";', '', 'describe("AccountService", () => {', '  it("accepts a known pair", () => {', '    expect(new AccountService().isKnownPair("a@b.c", "password1")).toBe(true);', '  });', '});', ''].join(NL);

/**
 * backend.implement: the module of the planned implementation record, its unit spec, the READ and the gate the contract orders (`starci gate run --root <app> --changed <files> --out gate.json`).
 * The op reports done only on a green gate (exit 0); a gate that could not run (exit 2: the tree holds no installed toolchain) is reported blocked with the typed kind `environment`.
 */
STANDINS['backend.implement'] = ({ walk, jobId }) => {
  const dir = 'be/src/modules/domain/account';
  const source = [put(walk.tree, `${dir}/account.service.ts`, SERVICE), put(walk.tree, `${dir}/account.service.spec.ts`, SERVICE_SPEC)];
  const read = readCheck({ walk, jobId, op: 'backend.implement', touches: source });
  const gateOut = path.join(scratchOf(walk.world, jobId), 'gate.json');
  const base = walk.world.tree.baseline;
  const gate = walk.sh(['gate', 'run', '--root', walk.tree, '--base', base, ...source.flatMap((f) => ['--changed', f]), '--out', gateOut], { jobId });
  const checks = [read.check, { name: 'starci-gate', command: `starci gate run --root ${walk.tree} --base ${base} ${source.map((f) => `--changed ${f}`).join(' ')} --out ${gateOut}`, exitCode: gate.status ?? 1, phase: 'verify', evidence: 'op gate' }];
  const blocked = gate.status !== 0;
  const report = blocked
    ? envelope('backend.implement', 'The routine gate could not run: the tree holds no installed toolchain.', source, checks, { outcome: 'blocked', blocker: { kind: 'environment', detail: 'starci gate run exited 2: the checker could not run (no installed dependencies in the workflow tree)' } })
    : envelope('backend.implement', 'The account module and its unit spec are implemented and the gate is green.', source, checks);
  return { report, attach: [read.attach, ...(fs.existsSync(gateOut) ? [gateOut] : [])], steps: { read: read.result }, gate, blocked };
};
LEG_PATHS['backend.implement'] = [`${WORK}/features/${FEATURE}/impl/be/account`, 'be/src/modules/domain/account'];

// The paths a correct Kernel grants the legs the walk only probes (a stand-in cannot complete them on this host): the contract's feature families and the app's existing directories.
LEG_PATHS['interface.draw'] = [`${WORK}/shell`, `${WORK}/features/${FEATURE}/ui`];
LEG_PATHS['provision.ask'] = [`${WORK}/features/${FEATURE}/evidence`];
LEG_PATHS['interface.implement'] = [`${WORK}/features/${FEATURE}/impl/fe/web`, 'fe/apps/web/src/app'];
LEG_PATHS['interface.audit'] = [`${WORK}/features/${FEATURE}/ui`];
LEG_PATHS['e2e.verify'] = [`${WORK}/features/${FEATURE}/uat`, 'be/src'];
LEG_PATHS['integration.verify'] = [`${WORK}/features/${FEATURE}/integration`, 'be/src'];
LEG_PATHS['review.verify'] = [`${WORK}/evidence/review`];
LEG_PATHS['handover.review'] = [`${WORK}/evidence/wf-walk.handover`];
