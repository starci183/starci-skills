// One step folder of one session (step-N-M/) is valid when: output.json passes the shared gate;
// request.md follows the request kind and names only Requirements the operator declares, with every
// required one filled; every Output the operator's operator.md declares is present when required,
// and each present one passes its kind (template for md, schema for data, existence for artifacts);
// a blocked stop is a code the operator may emit whose effective disposition is terminate; a taken
// fallback is a code whose effective disposition is fallback. Effective means after `unless` is
// evaluated against the Requirements values in request.md. Operator-specific cross-field law lives
// in operators/<id>/validate.mjs, which calls this first.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { checkDocument, loadKindTemplates } from './validate-templates.mjs';
import { loadOperatorPackages, kindOf, isYes } from './operator-md.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';

const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');

// The rows of the first table under `## <heading>` as [first cell, second cell, ...] with backticks removed.
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
  // `artifacts/<decisionId>-alternatives.html` → a regex where every <param> is one path-safe token.
  const esc = unquote(fileCell).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/<[^>]+>/g, '[A-Za-z0-9_.-]+');
  return new RegExp(`^${esc}$`);
}

export function effectiveDisposition(entry, requirements) {
  if (entry.unless && String(requirements[entry.unless.param] ?? '') === String(entry.unless.equals)) return entry.unless.then;
  return entry.disposition;
}

export async function validateStep(root, stepDir) {
  const errors = [];
  const rel = (f) => path.relative(root, path.join(stepDir, f)).split(path.sep).join('/');
  const readJson = async (f) => { try { return JSON.parse(await readFile(path.join(stepDir, f), 'utf8')); } catch (e) { errors.push(`${rel(f)}: ${e.message}`); return null; } };
  const outputSchema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'output.schema.json'), 'utf8'));
  const inputSchema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'input.schema.json'), 'utf8'));
  const output = await readJson('output.json');
  if (!output) return { errors, output: null };
  errors.push(...validateAgainst(outputSchema, output, 'output.json'));
  if (output.status === 'done' && output.stop !== undefined) errors.push('output.json: status done may not carry a stop');
  if (existsSync(path.join(stepDir, 'input.json'))) {
    const input = await readJson('input.json');
    if (input) {
      errors.push(...validateAgainst(inputSchema, input, 'input.json'));
      if (input.operatorId !== output.operatorId) errors.push('input.json and output.json name different operators');
      if (input.step !== output.step) errors.push('input.json and output.json name different steps');
    }
  } else errors.push(`${rel('input.json')}: missing`);

  const packages = await loadOperatorPackages(root);
  const pkg = packages.find((p) => p.manifest.id === output.operatorId);
  if (!pkg) { errors.push(`output.json: unknown operator ${output.operatorId}`); return { errors, output }; }
  if (pkg.shape !== 'v9') { errors.push(`${output.operatorId} is not an operator.md package; validate-step applies to operator.md packages only`); return { errors, output }; }
  const kinds = await loadKindTemplates(root);
  const registry = await loadErrorsRegistry(root);
  errors.push(...registry.errors);
  const op = pkg.en;

  // request.md: shape, then Requirements against the operator's table.
  const requirements = {};
  const reqFile = path.join(stepDir, 'request.md');
  if (!existsSync(reqFile)) errors.push(`${rel('request.md')}: missing`);
  else {
    const text = await readFile(reqFile, 'utf8');
    errors.push(...checkDocument(rel('request.md'), text, kinds.get('request'), 'en'));
    for (const [field, value] of tableUnder(text, '## Requirements') ?? []) requirements[field] = value;
    const declared = new Map((op.tables.requirements?.rows ?? []).map((r) => [unquote(r.field), r]));
    for (const field of Object.keys(requirements)) if (!declared.has(field)) errors.push(`${rel('request.md')}: Requirements names ${field}, which ${op.id} does not declare`);
    for (const [field, row] of declared) {
      const required = row.default.trim().startsWith('—');
      const value = requirements[field];
      if (required && (value === undefined || value === '' || value === '—')) errors.push(`${rel('request.md')}: required field ${field} has no value`);
    }
    const inputRows = tableUnder(text, '## Inputs') ?? [];
    const declaredInputs = new Map((op.tables.inputs?.rows ?? []).map((r) => [kindOf(r.kind), r]));
    for (const [kind] of inputRows) if (!declaredInputs.has(kind)) errors.push(`${rel('request.md')}: Inputs names ${kind}, which ${op.id} does not declare`);
    for (const [kind, row] of declaredInputs) if (isYes(row.required) && !inputRows.some(([k, from]) => k === kind && from && from !== '—')) errors.push(`${rel('request.md')}: required input ${kind} is absent`);
  }

  // Outputs: every declared kind, present when required, valid when present.
  const present = new Set();
  for (const row of op.tables.outputs?.rows ?? []) {
    const kind = kindOf(row.kind);
    const type = row.type.trim();
    const value = output.fields?.[kind];
    const files = value === undefined ? [] : Array.isArray(value) ? value : [value];
    if (files.length === 0) { if (isYes(row.required) && output.status === 'done') errors.push(`output.json: required output ${kind} is not in fields`); continue; }
    present.add(kind);
    const re = patternOf(row.file);
    for (const f of files) {
      if (!re.test(f)) errors.push(`output.json: fields.${kind} = ${f} does not match the declared file ${unquote(row.file)}`);
      const full = path.join(stepDir, f);
      if (!existsSync(full)) { errors.push(`${rel(f)}: listed in output.json but missing`); continue; }
      if (type === 'md') {
        const contract = kinds.get(kind);
        if (!contract) { errors.push(`templates/kinds/${kind}.template.md: missing`); continue; }
        errors.push(...checkDocument(rel(f), await readFile(full, 'utf8'), contract, 'en'));
      } else if (type === 'data') {
        const schemaPath = path.join(root, 'templates', 'kinds', `${kind}.schema.json`);
        if (!existsSync(schemaPath)) { errors.push(`templates/kinds/${kind}.schema.json: missing`); continue; }
        let value2; try { value2 = JSON.parse(await readFile(full, 'utf8')); } catch (e) { errors.push(`${rel(f)}: ${e.message}`); continue; }
        errors.push(...validateAgainst(JSON.parse(await readFile(schemaPath, 'utf8')), value2, rel(f)));
      }
    }
  }
  for (const kind of Object.keys(output.fields ?? {})) if (!(op.tables.outputs?.rows ?? []).some((r) => kindOf(r.kind) === kind)) errors.push(`output.json: fields.${kind} is not an Output of ${op.id}`);

  // Stops and fallbacks, with unless evaluated against the request.
  const stopsTable = new Set((op.tables.stops?.rows ?? []).map((r) => unquote(r.code)));
  const dispositionOf = (code) => {
    const entry = registry.codes[code];
    if (!entry || !registry.allowed(code, op.id)) return null;
    return effectiveDisposition(entry, requirements);
  };
  if (output.status === 'blocked') {
    const d = dispositionOf(output.stop);
    if (!stopsTable.has(output.stop)) errors.push(`output.json: stop ${output.stop} is not in the Stops table of ${op.id}`);
    if (d === null) errors.push(`output.json: stop ${output.stop} is not a registered code ${op.id} may emit`);
    else if (d !== 'terminate') errors.push(`output.json: ${output.stop} has disposition fallback under these Requirements; the step should have continued`);
  }
  for (const code of output.fallbacks ?? []) {
    const d = dispositionOf(code);
    if (!stopsTable.has(code)) errors.push(`output.json: fallback ${code} is not in the Stops table of ${op.id}`);
    if (d === null) errors.push(`output.json: fallback ${code} is not a registered code ${op.id} may emit`);
    else if (d !== 'fallback') errors.push(`output.json: ${code} has disposition terminate under these Requirements; it cannot be taken as a fallback`);
  }
  const responseKind = (op.tables.outputs?.rows ?? []).find((r) => unquote(r.file) === 'response.md');
  if (responseKind && present.has(kindOf(responseKind.kind))) {
    const taken = (tableUnder(await readFile(path.join(stepDir, 'response.md'), 'utf8'), '## Fallbacks taken') ?? []).map(([c]) => c);
    const declaredTaken = new Set(output.fallbacks ?? []);
    for (const c of taken) if (!declaredTaken.has(c)) errors.push(`response.md: Fallbacks taken lists ${c}, which output.json does not`);
    for (const c of declaredTaken) if (!taken.includes(c)) errors.push(`output.json: fallback ${c} is not recorded under ## Fallbacks taken in response.md`);
  }
  for (const nextId of output.next ?? []) if (!packages.some((p) => p.manifest.id === nextId)) errors.push(`output.json: next names unknown operator ${nextId}`);
  return { errors, output, requirements, present };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-step.mjs <session>/step-N-M\n'); process.exit(2); }
  const dir = path.resolve(target);
  const { errors } = await validateStep(root, dir);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`${path.basename(dir)}: valid\n`);
}
