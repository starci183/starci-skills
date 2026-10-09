// walk-standins.mjs - the scripted op of the workflow walk: what a correct op does for each op kind, derived from the op's contract (modules/ops/ops/<op>.yaml) and the packet
// the dispatch wrote. Each stand-in returns the report envelope and the files to attach; it writes the lawful product into the workflow tree and runs the commands the packet
// names (starci gate read, starci runtime validate, starci work graph propose) through the real CLI.
import fs from 'node:fs';
import path from 'node:path';
import { FEATURE, scratchOf } from './walk-world.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { recordsOf } from './walk-records.mjs';

export const WORK = '.starciwork';
const readOp = (root, op) => parseYaml(fs.readFileSync(path.join(root, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'));
const put = (tree, rel, text) => { fs.mkdirSync(path.dirname(path.join(tree, rel)), { recursive: true }); fs.writeFileSync(path.join(tree, rel), text); return rel; };
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

export const STANDINS = {
  'business.decide': familyStandIn('business.decide', ['fr', 'br'], 'Business rules and requirements decided.'),
  'architecture.decide': familyStandIn('architecture.decide', ['sds', 'contract', 'integration'], 'Contracts and integrations decided.'),
  'scope.define'({ walk, jobId }) {
    const { tree, world } = walk;
    const feature = `${WORK}/features/${FEATURE}/index.yaml`;
    const files = [put(tree, feature, yamlOf(['schema: work/feature@1', `id: ${FEATURE}`, 'title: A person signs up, signs in and keeps a session.', 'description: Account, sign-in and the session every other service verifies against.',
      'extensions:', '  work3:', '    scope:', ...JSON.stringify(SCOPE, null, 2).split('\n').map((line) => `      ${line}`)])),
    put(tree, `${WORK}/index.yaml`, yamlOf(['schema: work/catalog@1', 'id: auth', 'description: The authentication product.', 'features:', `  - id: ${FEATURE}`, `    directory: features/${FEATURE}`, '    description: Sign-up, sign-in and the session.']))];
    const graph = proposeGraph({ walk, jobId, graph: GRAPH(world.wf), reason: 'work graph v0' });
    const read = readCheck({ walk, jobId, op: 'scope.define', touches: files });
    const validate = validateCheck(walk, null, jobId);
    return { report: envelope('scope.define', 'Scope bounded: two nodes, one dependency, one exclusion.', files, [read.check, validate.check]), attach: [read.attach], steps: { graph, read: read.result, validate: validate.result } };
  },
};

const BRAND = ['schema: work/brand@1', 'id: brand', 'kind: brand', 'state: done', 'rev: 1', 'brand:', '  identity:', '    name: Acme', '    family: heroui',
  '  color:', '    primary: "#0D9488"', '    surface: "#FFFFFF"', '  typography:', '    sans: Inter', '  mascot:', '    name: none', '  imagery:', '    auth: split-screen',
  '  forbidden:', '    - Never ship text on the primary colour below a 4.5 to 1 contrast ratio.', 'review:', '  reviewer: brand owner', '  authority: Owner settled rev 1.', '  reviewedAt: 2026-10-09T10:00:00.000Z', ''].join('\n');

const NL = String.fromCharCode(10);
const SHELL_EVIDENCE = ['schema: work/evidence@1', 'record: shell', 'outcome: pass', 'assertions:', '  - id: shell#conformance', '    command: starci work shell-conformance .starciwork/shell/index.yaml', '    exit: 0', '    outcome: pass',
  '    observation: The layout tree is done, every visible layout has a slot-measured capture at desktop and mobile, and the lockup is a cropped render.', 'provenance:', '  actor: brand.decide', ''].join(NL);

const png = async (walk) => {
  const { blankImage, drawOver, encodePng } = await import('../../scripts/work/png.mjs');
  const capture = (w, h, slot) => { const image = blankImage(w, h, [30, 60, 90, 255]); drawOver(image, blankImage(slot.width, slot.height, [255, 0, 255, 255]), slot.x, slot.y); return encodePng(image); };
  const dir = path.join(scratchOf(walk.world, walk.currentJob), 'captures', 'layouts');
  fs.mkdirSync(dir, { recursive: true });
  const files = { desktop: path.join(dir, 'web--locale--desktop--light.png'), mobile: path.join(dir, 'web--locale--mobile--light.png') };
  fs.writeFileSync(files.desktop, capture(1440, 900, { x: 240, y: 64, width: 1200, height: 836 }));
  fs.writeFileSync(files.mobile, capture(390, 844, { x: 0, y: 56, width: 390, height: 788 }));
  return files;
};

/** brand.decide: the brand record and the settled layout tree of the shell (scan, capture each visible layout at each breakpoint, crop the lockup, persona, settle), through the real verbs. */
STANDINS['brand.decide'] = async ({ walk, jobId }) => {
  walk.currentJob = jobId;
  const sh = (args) => walk.sh(args, { jobId });
  const steps = { scan: sh(['work', 'layout-tree', 'scan', '--work', WORK, '--write']) };
  const files = await png(walk);
  for (const bp of ['desktop', 'mobile']) steps[`capture-${bp}`] = sh(['work', 'layout-tree', 'capture', '--work', WORK, '--node', '/[locale]', '--breakpoint', bp, '--theme', 'light', '--file', files[bp], '--write']);
  steps.lockup = sh(['work', 'layout-tree', 'lockup', '--work', WORK, '--from', 'shell/assets/layouts/web--locale--desktop--light.png', '--rect', '10,10,100,30', '--write']);
  const shellFile = path.join(walk.tree, WORK, 'shell', 'index.yaml');
  let shell = fs.readFileSync(shellFile, 'utf8').replace(/^state: todo/m, 'state: done').replace(/(layout:\n\s+component: AppLayout\n\s+chrome: visible\n\s+state: )todo/, '$1done');
  if (!/^personas:/m.test(shell)) shell = shell.replace(/^themes:/m, 'personas:\n  - role: owner\n    default: true\n    workspace: Acme\n    user: An Nguyen\n    currency: VND\n    dateFormat: dd/MM/yyyy\nthemes:');
  fs.writeFileSync(shellFile, shell);
  const brand = put(walk.tree, `${WORK}/brand/index.yaml`, BRAND);
  const shellEvidence = put(walk.tree, `${WORK}/shell/evidence.yaml`, SHELL_EVIDENCE);
  const conformance = sh(['work', 'shell-conformance', `${WORK}/shell/index.yaml`]);
  const conformanceFile = path.join(scratchOf(walk.world, jobId), 'shell-conformance.txt');
  fs.writeFileSync(conformanceFile, `${conformance.stdout}\n`);
  const brandCheck = sh(['work', 'brand', WORK]);
  steps.conformance = conformance; steps.brandCheck = brandCheck;
  const read = readCheck({ walk, jobId, op: 'brand.decide', touches: [brand, `${WORK}/shell/index.yaml`] });
  const validate = validateCheck(walk, null, jobId);
  const checks = [read.check, validate.check, { name: 'shell-conformance', command: `starci work shell-conformance ${WORK}/shell/index.yaml`, exitCode: conformance.status ?? 1, phase: 'verify', evidence: 'layout tree settled' },
    { name: 'brand-checks', command: `starci work brand ${WORK}`, exitCode: brandCheck.status ?? 1, phase: 'verify', evidence: 'brand checks' }];
  return { report: envelope('brand.decide', 'Brand rev 1 settled; shell layout tree captured and conformant.', [brand, `${WORK}/shell/index.yaml`], checks), attach: [read.attach, conformanceFile, ...Object.values(files)], steps: { ...steps, read: read.result, validate: validate.result } };
};
LEG_PATHS['brand.decide'] = [`${WORK}/brand`, `${WORK}/shell`];
