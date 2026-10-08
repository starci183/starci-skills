#!/usr/bin/env node
// decision-critic.mjs - the independent Critic of a decision leg (scope.define, architecture.decide). One single-pass run of the
// standard Critic (draw-critic.mjs runCritic over critic-pick.mjs, critic-guard.mjs, critic-verdict.mjs; modules/kernel/critic.yaml):
// a fresh Orca worker of the Critic tier and of another provider than the op, confined to a directory that holds only the op's decision
// records, the records they cite, a manifest and the rubric of its kind (modules/kernel/critic-rubrics.yaml). It answers with one typed
// verdict (starci/critic-verdict@1) carrying the sha256 of every byte it judged. The op runs this verb once its records are written;
// starci kernel settle (scripts/kernel/critic-settle.mjs) requires the verdict for exactly those bytes.
//
//   starci work decision-critic --kind scope.define|architecture.decide --root <work root or repo> --out <STARCI_JOB_SCRATCH>/critic-verdict.json
//       [--records <csv of record files or directories>] [--input <csv of extra files, e.g. the goal or request text>] [--maker <provider>] [--json]
//
// Exit 0 judged and passing; 1 judged and failing (the verdict lists every failed check with its fix: fix the records and run it again);
// 3 no verdict - a hold of the Critic (CRITIC_NO_INDEPENDENT_MEMBER, CRITIC_UNAVAILABLE, CRITIC_QUOTA_OUT, CRITIC_AUTHOR_UNKNOWN, ...):
// report blocked with the code, never a pass; 2 bad usage.
import fs from 'node:fs';
import path from 'node:path';
import { allocationSettings } from '../../engine/config.mjs';
import { slash } from '../lib/path-key.mjs';
import { isMain } from '../lib/is-main.mjs';
import { valueAfter } from '../lib/cli-arg.mjs';
import { splitList } from '../lib/list.mjs';
import { renderRoleLines } from '../machine/roles-contract.mjs';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { failedCheckLines } from './critic-verdict.mjs';
import { contextualCriticFor, runCritic } from './draw-critic.mjs';
import { citedInputs, criticRubrics, decisionRubric, kindEntryOf, productFiles } from './decision-critic-product.mjs';
import { workRootOf } from './work-io.mjs';

const SUBJECT = Object.freeze({ title: 'decision', objective: 'independent critique of one decision leg' });
const MANIFEST = 'manifest.yaml';

const extOf = (file) => path.extname(file) || '.txt';

/** The files of the Critic's directory: the product, the cited inputs, the extra inputs, and the manifest naming them. */
function handedFiles({ product, inputs, extras, unhanded }) {
  const files = [
    ...product.map((p, i) => ({ file: `product-${i + 1}${extOf(p.abs)}`, label: p.rel, role: 'product', from: p.abs })),
    ...inputs.map((p, i) => ({ file: `input-${i + 1}${extOf(p.abs)}`, label: p.rel, role: 'input', from: p.abs })),
    ...extras.map((abs, i) => ({ file: `extra-${i + 1}${extOf(abs)}`, label: `extra:${path.basename(abs)}`, role: 'input', from: abs })),
  ];
  const listing = (role) => files.filter((f) => f.role === role).map((f) => ({ file: f.file, label: f.label }));
  const manifest = { schema: 'starci/critic-manifest@1', product: listing('product'), inputs: listing('input'), citedButNotHanded: unhanded };
  return [...files, { file: MANIFEST, label: 'manifest', role: 'rubric', content: stringifyYaml(manifest) }];
}

/** The Critic's Task for a decision critique: the directory, what each file is, the rubric, the one file it writes. */
function decisionPrompt({ kind, files }) {
  return ({ dir, rubricFile, verdictFile }) => {
    const at = (f) => slash(path.join(dir, f));
    const list = (role) => files.filter((f) => f.role === role && f.file !== MANIFEST).map((f) => `${at(f.file)} (${f.label})`).join(', ') || 'none';
    return [
      `You are an independent senior reviewer of ONE decision of kind ${kind}. You did NOT make it and you have no other context.`,
      ...renderRoleLines('critic'),
      `Your directory is ${slash(dir)}. The decision records to judge: ${list('product')}. The inputs those records cite, which a decision must rest on and not contradict: ${list('input')}. ${at(MANIFEST)} says what each file is and which citations could not be handed; the rubric is ${at(rubricFile)}.`,
      `Judge strictly and only what you can read in these files. Read only these files. Do not edit, create, delete or run anything; the one file you may write is ${at(verdictFile)}.`,
      `For EVERY check in ${rubricFile}: pass true/false, one line of evidence (the record id and field you read), and for a failure the concrete fix.`,
      'Then give the overall score 1-10 by the rubric\'s anchors; a failed gate check caps the score at the rubric\'s gateCap.',
      `Write ONE JSON object to ${at(verdictFile)}, exactly this shape and nothing else:`,
      '{"schema":"starci/decision-critique@1","checks":[{"id":"S1","pass":true,"evidence":"...","fix":null}],"score":7,"anchor":"<the anchor you matched>","summary":"<two sentences: the biggest problem and the most valuable fix>"}',
      'Then report worker_done exactly once. If you cannot judge, report an escalation saying why instead of writing a verdict.',
    ].join('\n');
  };
}

const failed = (code, error) => ({ outcome: 'not-configured', code, verdict: null, error });

/**
 * Critique the decision records of `kind` under `workRoot`. `records` (absolute files) narrows the product to those records, `extras` are
 * further input files, `maker` the provider of the op ({provider, model} or a name; default: the op's terminal context), `orca` a fake client
 * (tests). Returns {critique, document}: the critique.json body (never throws) and the verdict document to write, or null with no verdict.
 */
export async function critiqueDecision({ kind, workRoot, records = null, extras = [], maker = undefined, orca = null, placement = {}, settings = allocationSettings().drawLoop, rubrics = criticRubrics(), ...clock }) {
  const entry = kindEntryOf(kind, rubrics);
  if (!entry) return { critique: failed(null, `no Critic rubric for ${kind} (modules/kernel/critic-rubrics.yaml)`), document: null };
  const product = productFiles({ workRoot, entry, files: records });
  if (!product.length) return { critique: failed(null, `${workRoot} holds no decision record of ${kind} (${entry.product.records.join(', ')})`), document: null };
  const { handed, unhanded } = citedInputs({ workRoot, product, entry, inputs: rubrics.inputs });
  const files = handedFiles({ product, inputs: handed, extras, unhanded });
  const { drawer: who, ...pick } = contextualCriticFor(settings, maker);
  if (pick.error) return { critique: { ...failed(pick.code ?? null, pick.error), critic: { independent: false } }, document: null };
  const critique = await runCritic({ rubric: decisionRubric(entry), critic: pick.critic, minimum: entry.minimum, orca, placement, ...clock,
    spec: { files, prompt: decisionPrompt({ kind, files }), subject: SUBJECT } });
  critique.critic = { ...critique.critic, maker: typeof who === 'string' ? who : who?.provider ?? null };
  const document = critique.verdict ? { ...critique.verdict, kind, op: kind, at: new Date().toISOString(), maker: pick.critic.author.provider, unhanded, minimum: entry.minimum } : null;
  return { critique, document };
}

const usage = 'usage: decision-critic --kind <scope.define|architecture.decide> --root <work root or repo> --out <verdict file> [--records <csv>] [--input <csv>] [--maker <provider>] [--json]';

function workRootArg(root) {
  const base = path.resolve(root);
  if (path.basename(base) === '.starciwork') return base;
  const child = path.join(base, '.starciwork');
  return fs.existsSync(child) ? child : workRootOf(base);
}

const exitCodeOf = (document) => {
  if (!document) return 3;
  return document.pass ? 0 : 1;
};

function plainText({ kind, critique, document }) {
  let head = `critic NO VERDICT ${critique.code ?? ''}: ${critique.error ?? critique.outcome}`;
  if (document) {
    const verdict = document.pass ? 'PASS' : 'FAIL';
    head = `critic ${verdict} ${kind}: score ${document.beauty ?? 'none'} (minimum ${document.minimum}), ${document.product.length} record(s) judged`;
  }
  return [head, ...failedCheckLines(document?.checks).map((line) => `  ${line}`), ''].join('\n');
}

/** The verb: argv -> {text, exitCode}. */
export async function decisionCriticMain(argv, io = {}) {
  const kind = valueAfter(argv, '--kind'), root = valueAfter(argv, '--root'), out = valueAfter(argv, '--out');
  const workRoot = root ? workRootArg(root) : null;
  if (!kind || !workRoot || !out) return { text: `${usage}\n`, exitCode: 2 };
  const resolve = (p) => path.resolve(root, p);
  const records = splitList(valueAfter(argv, '--records')).map(resolve);
  const extras = splitList(valueAfter(argv, '--input')).map((p) => path.resolve(p));
  const { critique, document } = await critiqueDecision({ kind, workRoot, records: records.length ? records : null, extras,
    maker: valueAfter(argv, '--maker') ?? undefined, ...io });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(path.resolve(out).replace(/\.json$/, '') + '.critique.json', `${JSON.stringify(critique, null, 2)}\n`);
  if (document) fs.writeFileSync(path.resolve(out), `${JSON.stringify(document, null, 2)}\n`);
  else fs.rmSync(path.resolve(out), { force: true });
  const exitCode = exitCodeOf(document);
  const text = argv.includes('--json') ? `${JSON.stringify({ exitCode, code: critique.code ?? null, outcome: critique.outcome, error: critique.error ?? null, verdict: document }, null, 2)}
` : plainText({ kind, critique, document });
  return { text, exitCode };
}

if (isMain(import.meta.url)) {
  const result = await decisionCriticMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
