// The response half of one branch (step-N/parallel-M/response/), checked after the agent stops: the
// gate schema; every Output the operator's operator.md declares is present when required and valid
// when present (markdown kinds through templates/kinds/<kind>.contract.json, data kinds through
// <kind>.schema.json, artifacts by existence); a blocked stop is a code the operator may emit whose
// effective disposition is terminate; a taken fallback is one whose effective disposition is fallback
// and is recorded under ## Fallbacks taken; a waiting status names a declared exchange; a nested
// exchange's own response is checked the same way. Effective means after `unless` is evaluated
// against request.json requirements. Operator-specific law lives in operators/<id>/validate.mjs.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { checkDocument, loadKindTemplates } from './validate-templates.mjs';
import { loadOperatorPackages, kindOf, isYes, exchangeOf } from './operator-md.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';
import { sessionRootOf } from './validate-request.mjs';

const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');

// Rows of the first table under `## <heading>`, cells unquoted.
export function tableUnder(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  const rows = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    if (lines[i].startsWith('|') && /^\|\s*-{3,}/.test(lines[i + 1] ?? '')) { inTable = true; i += 1; continue; }
    if (inTable) { if (!lines[i].startsWith('|')) break; rows.push(lines[i].split('|').slice(1, -1).map((c) => unquote(c))); }
  }
  return rows;
}
function patternOf(fileCell) {
  const esc = unquote(fileCell).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/<[^>]+>/g, '[A-Za-z0-9_.-]+');
  return new RegExp(`^${esc}$`);
}
export function effectiveDisposition(entry, requirements) {
  if (entry.unless && String(requirements?.[entry.unless.param] ?? '') === String(entry.unless.equals)) return entry.unless.then;
  return entry.disposition;
}

// `dir` is the branch (or exchange) folder; `requirements` come from the branch's request.json.
export async function validateResponse(root, dir, { requirements = {}, exchange = null, packages, kinds, registry } = {}) {
  const errors = [];
  const rel = (f) => path.relative(sessionRootOf(dir) ?? dir, path.join(dir, f)).split(path.sep).join('/');
  const file = path.join(dir, 'response', 'response.json');
  if (!existsSync(file)) return { errors: [`${rel('response/response.json')}: missing`], response: null, present: new Set() };
  let response; try { response = JSON.parse(await readFile(file, 'utf8')); } catch (e) { return { errors: [`${rel('response/response.json')}: ${e.message}`], response: null, present: new Set() }; }
  const schema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'response.schema.json'), 'utf8'));
  errors.push(...validateAgainst(schema, response, rel('response/response.json')));
  if (response.status !== 'blocked' && response.stop !== undefined) errors.push(`${rel('response/response.json')}: only a blocked response carries a stop`);
  if (response.status !== 'waiting' && response.awaiting !== undefined) errors.push(`${rel('response/response.json')}: only a waiting response carries awaiting`);
  if ((response.exchange ?? null) !== exchange) errors.push(`${rel('response/response.json')}: exchange ${response.exchange ?? 'none'} does not match the folder ${exchange ?? 'none'}`);
  packages ??= await loadOperatorPackages(root);
  const pkg = packages.find((p) => p.manifest.id === response.operatorId);
  if (!pkg) { errors.push(`response.json: unknown operator ${response.operatorId}`); return { errors, response, present: new Set() }; }
  if (pkg.shape !== 'v9') { errors.push(`${response.operatorId} is not an operator.md package`); return { errors, response, present: new Set() }; }
  kinds ??= await loadKindTemplates(root);
  registry ??= await loadErrorsRegistry(root);
  errors.push(...registry.errors);
  const op = pkg.en;

  // Which Outputs belong to this folder: the branch owns files without an exchange prefix, an exchange owns its own.
  const outputs = (op.tables.outputs?.rows ?? []).filter((r) => exchangeOf(unquote(r.file)) === exchange);
  const present = new Set();
  for (const row of outputs) {
    const kind = kindOf(row.kind);
    const type = row.type.trim();
    // Inside an exchange folder the declared file is <exchange>/response/x; the response.json there lists response/x.
    const declaredFile = exchange ? unquote(row.file).replace(`${exchange}/`, '') : unquote(row.file);
    const value = response.fields?.[kind];
    const files = value === undefined ? [] : Array.isArray(value) ? value : [value];
    if (files.length === 0) { if (isYes(row.required) && response.status === 'done') errors.push(`${rel('response/response.json')}: required output ${kind} is not in fields`); continue; }
    present.add(kind);
    const re = patternOf(declaredFile);
    for (const f of files) {
      if (!re.test(f)) errors.push(`${rel('response/response.json')}: fields.${kind} = ${f} does not match the declared file ${declaredFile}`);
      const full = path.join(dir, f);
      if (!existsSync(full)) { errors.push(`${rel(f)}: listed in response.json but missing`); continue; }
      if (type === 'md') {
        const contract = kinds.get(kind);
        if (!contract) { errors.push(`templates/kinds/${kind}.contract.json: missing`); continue; }
        errors.push(...checkDocument(rel(f), await readFile(full, 'utf8'), contract, 'en'));
      } else if (type === 'data') {
        const schemaPath = path.join(root, 'templates', 'kinds', `${kind}.schema.json`);
        if (!existsSync(schemaPath)) { errors.push(`templates/kinds/${kind}.schema.json: missing`); continue; }
        let value2; try { value2 = JSON.parse(await readFile(full, 'utf8')); } catch (e) { errors.push(`${rel(f)}: ${e.message}`); continue; }
        errors.push(...validateAgainst(JSON.parse(await readFile(schemaPath, 'utf8')), value2, rel(f)));
      }
    }
  }
  for (const kind of Object.keys(response.fields ?? {})) if (!outputs.some((r) => kindOf(r.kind) === kind)) errors.push(`${rel('response/response.json')}: fields.${kind} is not an Output of ${op.id}${exchange ? ` in exchange ${exchange}` : ''}`);

  // Stops, fallbacks, waiting.
  const stopsTable = new Set((op.tables.stops?.rows ?? []).map((r) => unquote(r.code)));
  const dispositionOf = (code) => { const e = registry.codes[code]; return e && registry.allowed(code, op.id) ? effectiveDisposition(e, requirements) : null; };
  if (response.status === 'blocked') {
    const d = dispositionOf(response.stop);
    if (!stopsTable.has(response.stop)) errors.push(`${rel('response/response.json')}: stop ${response.stop} is not in the Stops table of ${op.id}`);
    if (d === null) errors.push(`${rel('response/response.json')}: stop ${response.stop} is not a registered code ${op.id} may emit`);
    else if (d !== 'terminate') errors.push(`${rel('response/response.json')}: ${response.stop} has disposition fallback under these requirements; the step should have continued`);
  }
  for (const code of response.fallbacks ?? []) {
    const d = dispositionOf(code);
    if (!stopsTable.has(code)) errors.push(`${rel('response/response.json')}: fallback ${code} is not in the Stops table of ${op.id}`);
    if (d === null) errors.push(`${rel('response/response.json')}: fallback ${code} is not a registered code ${op.id} may emit`);
    else if (d !== 'fallback') errors.push(`${rel('response/response.json')}: ${code} has disposition terminate under these requirements; it cannot be taken as a fallback`);
  }
  if (response.status === 'waiting') {
    const declared = (op.tables.outputs?.rows ?? []).filter((r) => exchangeOf(unquote(r.file)) === response.awaiting?.exchange);
    if (!declared.length) errors.push(`${rel('response/response.json')}: awaiting exchange ${response.awaiting?.exchange} is declared by no Output of ${op.id}`);
    else if (!declared.some((r) => kindOf(r.kind) === response.awaiting?.kind)) errors.push(`${rel('response/response.json')}: awaiting kind ${response.awaiting?.kind} is not produced by exchange ${response.awaiting?.exchange}`);
  }
  const mainMd = outputs.find((r) => /\/response\.md$/.test(unquote(r.file)));
  if (mainMd && present.has(kindOf(mainMd.kind))) {
    const text = await readFile(path.join(dir, 'response', 'response.md'), 'utf8');
    const taken = (tableUnder(text, '## Fallbacks taken') ?? []).map(([c]) => c);
    const declaredTaken = new Set(response.fallbacks ?? []);
    for (const c of taken) if (!declaredTaken.has(c)) errors.push(`${rel('response/response.md')}: Fallbacks taken lists ${c}, which response.json does not`);
    for (const c of declaredTaken) if (!taken.includes(c)) errors.push(`${rel('response/response.json')}: fallback ${c} is not recorded under ## Fallbacks taken in response.md`);
  }
  for (const nextId of response.next ?? []) if (!packages.some((p) => p.manifest.id === nextId)) errors.push(`${rel('response/response.json')}: next names unknown operator ${nextId}`);
  if (exchange && (response.next ?? []).length) errors.push(`${rel('response/response.json')}: a nested exchange does not route; next must be empty`);
  return { errors, response, present, pkg };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-response.mjs <session>/step-N/parallel-M[/<exchange>]\n'); process.exit(2); }
  const dir = path.resolve(target);
  const exchange = /^step-\d+$/.test(path.basename(path.dirname(path.dirname(dir)))) ? null : path.basename(dir);
  let requirements = {};
  const reqFile = path.join(exchange ? path.dirname(dir) : dir, 'request', 'request.json');
  if (existsSync(reqFile)) requirements = JSON.parse(await readFile(reqFile, 'utf8')).requirements ?? {};
  const { errors } = await validateResponse(root, dir, { requirements, exchange });
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('response valid\n');
}
