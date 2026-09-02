// An operator.md package is closed when its own tables agree with each other, with the stop-code
// registry, with the kind templates, and with its Vietnamese mirror. This is the three-way check the
// old shape spread over four documents and two schemas: Params ↔ Requirements, Steps ↔ Stops ↔
// errors registry, Writes ↔ Outputs ↔ templates/kinds, Inputs ↔ templates/kinds, en ↔ vi.
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages, cellCodes, cellParams, cellFiles, kindOf, isYes } from './operator-md.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';
import { loadKindTemplates } from './validate-templates.mjs';

const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');

export async function validateOperators(root) {
  const errors = [];
  const packages = await loadOperatorPackages(root);
  const registry = await loadErrorsRegistry(root);
  errors.push(...registry.errors);
  const kinds = await loadKindTemplates(root);
  const ids = new Set(packages.map((p) => p.manifest.id));
  let checked = 0;
  for (const pkg of packages.filter((p) => p.shape === 'v9')) {
    checked += 1;
    const id = pkg.manifest.id;
    const at = `operators/${pkg.name}/operator.md`;
    const op = pkg.en;
    if (op.id !== id) errors.push(`${at}: title ${op.id} must equal operator.json id ${id}`);
    for (const key of ['context', 'inputs', 'requirements', 'steps', 'outputs', 'stops', 'next']) if (!op.tables[key]) errors.push(`${at}: no ${key} table`);
    if (Object.values(op.tables).some((t) => !t)) continue;
    for (const legacy of ['context.md', 'input.md', 'execute.md', 'output.md', 'input.schema.json', 'output.schema.json', 'validate-input.mjs', 'validate-output.mjs', 'validation.mjs']) {
      if (existsSync(path.join(pkg.dir, legacy))) errors.push(`operators/${pkg.name}/${legacy}: an operator.md package carries no ${legacy}`);
    }
    for (const needed of ['validate.mjs', 'self-test.mjs']) if (!existsSync(path.join(pkg.dir, needed))) errors.push(`operators/${pkg.name}/${needed}: missing`);

    // Params ↔ Requirements.
    const fields = new Map(op.tables.requirements.rows.map((r) => [unquote(r.field), r]));
    const usedFields = new Set();
    for (const s of op.tables.steps.rows) for (const p of cellParams(s.params)) { usedFields.add(p); if (!fields.has(p)) errors.push(`${at}:${s._line}: step ${s.n} reads param ${p}, which Requirements does not declare`); }
    for (const [f, r] of fields) if (!usedFields.has(f)) errors.push(`${at}:${r._line}: requirement ${f} is read by no step`);

    // Steps ↔ Stops ↔ registry.
    const stops = new Map(op.tables.stops.rows.map((r) => [unquote(r.code), r]));
    const usedCodes = new Set();
    for (const s of op.tables.steps.rows) for (const c of cellCodes(s.stops)) { usedCodes.add(c); if (!stops.has(c)) errors.push(`${at}:${s._line}: step ${s.n} stops with ${c}, which the Stops table omits`); }
    for (const [c, r] of stops) {
      if (!usedCodes.has(c)) errors.push(`${at}:${r._line}: stop ${c} is emitted by no step`);
      const entry = registry.codes[c];
      if (!entry) { errors.push(`${at}:${r._line}: stop ${c} is in no errors registry`); continue; }
      if (!registry.allowed(c, id)) errors.push(`${at}:${r._line}: stop ${c} is scoped to ${entry.scope.join(', ')}, not ${id}`);
      if (r.disposition.trim() !== entry.disposition) errors.push(`${at}:${r._line}: stop ${c} says ${r.disposition.trim()} but ${entry.home} says ${entry.disposition}`);
      if (entry.unless && !fields.has(entry.unless.param)) errors.push(`${entry.home}: ${c} unless names param ${entry.unless.param}, which ${id} does not declare`);
    }
    for (const [c, e] of Object.entries(registry.codes)) if (e.scope.length === 1 && e.scope[0] === id && !stops.has(c)) errors.push(`${e.home}: ${c} is defined for ${id} but its Stops table omits it`);
    if (!cellCodes(op.tables.steps.rows[0]?.stops ?? '').includes('INVALID_INPUT')) errors.push(`${at}: step 1 must be the gate and stop with INVALID_INPUT`);

    // Writes ↔ Outputs ↔ templates/kinds.
    const outputs = new Map();
    for (const r of op.tables.outputs.rows) {
      const kind = kindOf(r.kind); const file = unquote(r.file); const type = r.type.trim();
      if (outputs.has(kind)) errors.push(`${at}:${r._line}: output ${kind} is declared twice`);
      outputs.set(kind, { ...r, file, type });
      if (type === 'md') { if (!kinds.has(kind)) errors.push(`${at}:${r._line}: output ${kind} is md but templates/kinds/${kind}.template.md is missing`); if (!file.endsWith('.md')) errors.push(`${at}:${r._line}: md output ${kind} must be a .md file`); }
      if (type === 'data') { if (!existsSync(path.join(root, 'templates', 'kinds', `${kind}.schema.json`))) errors.push(`${at}:${r._line}: output ${kind} is data but templates/kinds/${kind}.schema.json is missing`); if (!/^data\/.+\.json$/.test(file)) errors.push(`${at}:${r._line}: data output ${kind} must live under data/ as .json`); }
      if (type === 'artifact' && !file.startsWith('artifacts/')) errors.push(`${at}:${r._line}: artifact output ${kind} must live under artifacts/`);
    }
    const written = new Set();
    for (const s of op.tables.steps.rows) for (const f of cellFiles(s.writes)) written.add(f);
    const outputFiles = new Set([...outputs.values()].map((o) => o.file));
    for (const f of written) if (f !== 'output.json' && !outputFiles.has(f)) errors.push(`${at}: a step writes ${f}, which Outputs does not declare`);
    for (const f of outputFiles) if (!written.has(f)) errors.push(`${at}: output ${f} is written by no step`);
    if (!written.has('output.json')) errors.push(`${at}: no step writes output.json`);

    // Inputs ↔ templates/kinds.
    for (const r of op.tables.inputs.rows) {
      const kind = kindOf(r.kind);
      if (kind === '—' || kind === '') continue;
      if (!kinds.has(kind) && !existsSync(path.join(root, 'templates', 'kinds', `${kind}.schema.json`))) errors.push(`${at}:${r._line}: input ${kind} has no template or schema under templates/kinds`);
    }
    for (const r of op.tables.next.rows) { const target = unquote(r.operator); if (!ids.has(target)) errors.push(`${at}:${r._line}: next names unknown operator ${target}`); }

    // en ↔ vi: same rows, same identifiers, same codes and params per step.
    if (!pkg.vi) { errors.push(`operators/${pkg.name}/operator.vi.md: missing`); continue; }
    const vi = pkg.vi;
    if (vi.id !== id) errors.push(`operators/${pkg.name}/operator.vi.md: title must be ${id}`);
    for (const key of ['context', 'inputs', 'requirements', 'steps', 'outputs', 'stops', 'next']) {
      const a = op.tables[key]; const b = vi.tables[key];
      if (!b) { errors.push(`operators/${pkg.name}/operator.vi.md: no ${key} table`); continue; }
      if (a.rows.length !== b.rows.length) { errors.push(`operators/${pkg.name}/operator.vi.md: ${key} has ${b.rows.length} rows, English has ${a.rows.length}`); continue; }
      const firstKey = { context: 'alias', inputs: 'kind', requirements: 'field', steps: 'n', outputs: 'kind', stops: 'code', next: 'operator' }[key];
      a.rows.forEach((ra, i) => {
        const rb = b.rows[i];
        if (unquote(ra[firstKey]) !== unquote(rb[firstKey])) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: ${key} row ${i + 1} is ${unquote(rb[firstKey])}, English has ${unquote(ra[firstKey])}`);
        if (key === 'steps') {
          if (cellCodes(ra.stops).join() !== cellCodes(rb.stops).join()) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: step ${ra.n} stop codes differ from English`);
          if (cellParams(ra.params).join() !== cellParams(rb.params).join()) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: step ${ra.n} params differ from English`);
          if (cellFiles(ra.writes).join() !== cellFiles(rb.writes).join()) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: step ${ra.n} writes differ from English`);
        }
        if (key === 'stops' && ra.disposition.trim() !== rb.disposition.trim()) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: ${unquote(ra.code)} disposition differs from English`);
        if (key === 'outputs' && (ra.type.trim() !== rb.type.trim() || unquote(ra.file) !== unquote(rb.file))) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: output ${unquote(ra.kind)} file or type differs from English`);
      });
    }
  }
  return { errors, checked, total: packages.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, checked, total } = await validateOperators(root);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`operators closed: ${checked} operator.md packages of ${total}\n`);
}
