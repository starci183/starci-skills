import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'landing.compose';
const RECEIPT = 'response/response.md';
const empty = (value) => value === undefined || value === null || value === '' || value === '—';

export function landingCompositionErrors(receipt, requirements = {}, response = {}) {
  const errors = [];
  const surface = requirements.surface;
  const title = receipt.split(/\r?\n/)[0] ?? '';
  if (!empty(surface) && title !== `# landing-composition — ${surface}`) {
    errors.push(`${RECEIPT}: title names ${title.replace(/^# landing-composition — /, '')}, the request names surface ${surface}`);
  }

  const authority = new Map(tableUnder(receipt, '## Authority') ?? []);
  if (empty(authority.get('Business promise'))) errors.push(`${RECEIPT}: Authority carries no business promise`);
  if (empty(authority.get('Grammar family'))) errors.push(`${RECEIPT}: Authority carries no Grammar family`);
  if (empty(authority.get('Visual identity'))) errors.push(`${RECEIPT}: Authority carries no canonical visual identity evidence`);

  const adoption = tableUnder(receipt, '## Grammar adoption') ?? [];
  if (!adoption.some((row) => row[2] === 'grammar')) errors.push(`${RECEIPT}: Grammar adoption binds no element to Grammar`);
  for (const [section, element, owner, reason] of adoption) {
    if (owner === 'custom' && empty(reason)) errors.push(`${RECEIPT}: custom ${section}/${element} carries no ownership reason`);
  }

  const storyboard = tableUnder(receipt, '## Visual storyboard') ?? [];
  const orders = storyboard.map((row) => row[0]);
  if (new Set(orders).size !== orders.length) errors.push(`${RECEIPT}: Visual storyboard repeats an order; the landing has one reading sequence`);
  if (storyboard.length && !storyboard.some((row) => row[1] === 'hero' || row[1] === '`hero`')) errors.push(`${RECEIPT}: Visual storyboard has no hero event`);

  const assets = tableUnder(receipt, '## Asset strategy') ?? [];
  for (const [slot, decision, identity] of assets) {
    if (decision === 'imagegen' && empty(identity)) errors.push(`${RECEIPT}: ImageGen slot ${slot} carries no identity evidence`);
  }

  const motion = tableUnder(receipt, '## Motion choreography') ?? [];
  for (const [section, , , reduced, budget] of motion) {
    if (empty(reduced)) errors.push(`${RECEIPT}: motion row ${section} carries no reduced-motion truth`);
    if (empty(budget)) errors.push(`${RECEIPT}: motion row ${section} carries no performance budget`);
  }

  const audit = new Map((tableUnder(receipt, '## Audit contract') ?? []).map((row) => [row[0], row]));
  for (const concern of ['visual storytelling', 'motion', 'reduced motion', 'performance']) {
    if (!audit.has(concern)) errors.push(`${RECEIPT}: Audit contract omits ${concern}`);
  }

  const ownership = new Map((tableUnder(receipt, '## Ownership handoff') ?? []).map((row) => [row[0], row]));
  const compose = ownership.get('landing.compose');
  const generate = ownership.get('interface.generate');
  const auditOwner = ownership.get('interface.audit');
  if (!compose || !/contract/i.test(compose[1]) || !/source/i.test(compose[2])) errors.push(`${RECEIPT}: landing.compose must own the contract and disown source`);
  if (!generate || !/source|implementation/i.test(generate[1])) errors.push(`${RECEIPT}: interface.generate must own source implementation`);
  if (!auditOwner || !/evidence|verdict/i.test(auditOwner[1]) || !/source|repair|direction/i.test(auditOwner[2])) errors.push(`${RECEIPT}: interface.audit must own evidence and disown source repair or direction`);

  if ((response.commits ?? []).length) errors.push(`response/response.json: ${OPERATOR} is read-only and carries no commits`);
  if (response.status === 'done' && (response.next?.length !== 1 || response.next[0] !== 'interface.draw')) {
    errors.push(`response/response.json: a completed composition hands off exactly to interface.draw`);
  }
  return errors;
}

export async function validateLandingComposeStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  if (response.status === 'done') {
    if (!present.has('landing-composition') || !existsSync(path.join(branchDir, RECEIPT))) {
      errors.push(`${RECEIPT}: missing completed landing composition`);
    } else {
      const receipt = await readFile(path.join(branchDir, RECEIPT), 'utf8');
      errors.push(...landingCompositionErrors(receipt, requirements, response));
    }
    const hasPromise = !empty(requirements.promise) || !empty(request?.inputs?.['business-promise-authority']);
    if (!hasPromise) errors.push(`request/request.json: a completed composition requires business-promise-authority or requirements.promise`);
    if (!(requirements.visualIdentity?.length > 0)) errors.push(`request/request.json: a completed composition requires visualIdentity evidence`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateLandingComposeStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; }
  else process.stdout.write('valid landing.compose branch\n');
}
