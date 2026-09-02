// frontend.surface.audit's own law over one branch, on top of the shared step check: every matrix entry in
// the verdicts has both a capture and a screenshot; every judged node was measured in that entry's
// capture and judged on a rule it actually claimed; a Grammar-owned node never routes a failure into
// the resolve loop and an application-owned failure always does; and the receipt reads what the
// verdicts carry.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const list = (v) => (Array.isArray(v) ? v : empty(v) ? [] : [v]);

export async function validateAuditStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'frontend.surface.audit') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  let verdicts = null;
  if (present.has('verdicts') && has('response/data/verdicts.json')) {
    try { verdicts = JSON.parse(await read('response/data/verdicts.json')); } catch { verdicts = null; }
  }
  if (!verdicts) {
    if (response.status === 'done') errors.push('response/data/verdicts.json: a done branch needs the verdicts');
    return { errors };
  }
  const at = 'response/data/verdicts.json';

  const captureRefs = new Set(list(response.fields?.capture));
  const shotRefs = new Set(list(response.fields?.screenshot));
  const narrowed = list(requirements.matrix);

  const captures = new Map();
  for (const ref of captureRefs) {
    if (!has(ref)) continue;
    let doc = null;
    try { doc = JSON.parse(await read(ref)); } catch { doc = null; }
    if (doc) captures.set(doc.matrixId, { doc, ref });
  }

  const ids = new Set();
  for (const entry of verdicts.entries) {
    if (ids.has(entry.matrixId)) errors.push(`${at}: matrix entry ${entry.matrixId} is judged twice`);
    ids.add(entry.matrixId);
    const capture = captures.get(entry.matrixId);
    if (!capture) { errors.push(`${at}: matrix entry ${entry.matrixId} has verdicts and no capture (EVIDENCE_MISSING)`); continue; }
    if (capture.ref !== `response/data/captures/${entry.matrixId}.json`) errors.push(`${capture.ref}: the capture of ${entry.matrixId} is not the file its id names`);
    if (!shotRefs.has(`response/artifacts/${entry.matrixId}.png`)) errors.push(`${at}: matrix entry ${entry.matrixId} has verdicts and no screenshot (EVIDENCE_MISSING)`);
    if (narrowed.length && !narrowed.some((m) => (typeof m === 'string' ? m : m.matrixId) === entry.matrixId)) {
      errors.push(`${at}: matrix entry ${entry.matrixId} was judged but the request narrowed the matrix without it`);
    }

    const nodes = new Map(capture.doc.nodes.map((n) => [n.path, n]));
    for (const result of entry.results) {
      const node = nodes.get(result.path);
      if (!node) { errors.push(`${at}: ${result.path} is judged under ${entry.matrixId} and was never measured there`); continue; }
      if (node.owner !== result.owner) errors.push(`${at}: ${result.path} is ${result.owner} here and ${node.owner} in the capture`);
      if (!node.claims.includes(result.rule)) errors.push(`${at}: ${result.path} is judged on ${result.rule}, which that node never claimed`);
      const measured = Object.values(node.measured);
      if (!measured.includes(result.measured)) errors.push(`${at}: ${result.path} is judged against ${result.measured}, which the capture did not measure`);
      if (result.verdict === 'pass' && result.routeTo !== 'none') errors.push(`${at}: ${result.path} passes and still routes to ${result.routeTo}`);
      if (result.verdict === 'fail') {
        if (result.owner === 'grammar' && result.routeTo === 'resolve') errors.push(`${at}: ${result.path} is a Grammar component's own render; a failure there is a grammar-gap, never a resolve loop`);
        if (result.owner === 'app' && result.routeTo !== 'resolve') errors.push(`${at}: ${result.path} is application-owned and its failure must route to resolve`);
        if (result.routeTo === 'none') errors.push(`${at}: ${result.path} fails and routes nowhere`);
      }
    }
    // Every claim a node carries is judged, or the claim is unaudited.
    for (const node of capture.doc.nodes) {
      for (const claim of node.claims) {
        if (!entry.results.some((r) => r.path === node.path && r.rule === claim)) errors.push(`${at}: ${node.path} claims ${claim} under ${entry.matrixId} and no verdict judges it`);
      }
    }
  }
  for (const [matrixId] of captures) if (!ids.has(matrixId)) errors.push(`${at}: ${matrixId} was captured and never judged`);

  const failing = verdicts.entries.flatMap((e) => e.results.filter((r) => r.verdict === 'fail'));
  if (failing.some((r) => r.routeTo === 'resolve') && !(response.next ?? []).includes('frontend.presentation.resolve')) {
    errors.push('response/response.json: a claim fails on an application-owned node, so next names frontend.presentation.resolve');
  }

  if (present.has('frontend-surface-audit') && has('response/response.md')) {
    const text = await read('response/response.md');
    const rel = 'response/response.md';
    const matrixRows = tableUnder(text, '## Matrix') ?? [];
    if (matrixRows.length !== verdicts.entries.length) errors.push(`${rel}: Matrix has ${matrixRows.length} rows, the verdicts carry ${verdicts.entries.length} entries`);
    for (const [id, viewport, scheme, state] of matrixRows) {
      const capture = captures.get(id);
      if (!capture) { errors.push(`${rel}: Matrix names ${id}, which has no capture`); continue; }
      if (`${capture.doc.viewport[0]}x${capture.doc.viewport[1]}` !== viewport) errors.push(`${rel}: ${id} is ${viewport} here and ${capture.doc.viewport.join('x')} in the capture`);
      if (capture.doc.scheme !== scheme || capture.doc.state !== state) errors.push(`${rel}: ${id} scheme or state differs from the capture`);
    }
    const rows = tableUnder(text, '## Verdicts by owner') ?? [];
    const all = verdicts.entries.flatMap((e) => e.results);
    if (rows.length !== all.length) errors.push(`${rel}: Verdicts by owner has ${rows.length} rows, the verdicts carry ${all.length} results`);
    for (const [matrixId, owner, node, rule, , verdict] of rows) {
      const entry = verdicts.entries.find((e) => e.matrixId === matrixId);
      const result = entry?.results.find((r) => r.path === node && r.rule === rule);
      if (!result) { errors.push(`${rel}: Verdicts by owner names ${rule} on ${node} under ${matrixId}, which the verdicts do not carry`); continue; }
      if (result.owner !== owner) errors.push(`${rel}: ${node} is ${owner} here and ${result.owner} in the verdicts`);
      if (result.verdict !== verdict) errors.push(`${rel}: ${rule} on ${node} is ${verdict} here and ${result.verdict} in the verdicts`);
    }
    const regressions = tableUnder(text, '## Regressions') ?? [];
    if (regressions.length !== failing.length) errors.push(`${rel}: Regressions has ${regressions.length} rows, the verdicts carry ${failing.length} failures`);
    for (const [matrixId, node, rule, , routeTo] of regressions) {
      const entry = verdicts.entries.find((e) => e.matrixId === matrixId);
      const result = entry?.results.find((r) => r.path === node && r.rule === rule && r.verdict === 'fail');
      if (!result) { errors.push(`${rel}: Regressions names ${rule} on ${node}, which no verdict fails`); continue; }
      if (result.routeTo !== routeTo) errors.push(`${rel}: ${rule} on ${node} routes to ${routeTo} here and ${result.routeTo} in the verdicts`);
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateAuditStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid frontend.surface.audit branch\n');
}
