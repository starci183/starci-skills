// A helper package is closed when its own tables agree with each other, with the stop-code registry,
// with the kind schemas, with the support layer's law and with its Vietnamese mirror.
//
// A helper is support work beside the operators (resources/orchestrator.json#helpers): it opens no
// session, writes no product source, touches no runtime and publishes nothing. That is not advice
// here; it is three refusals:
//   - every Writes alias is one alias/alias.json marks `helperWritable`, which no product source
//     route, no runtime owner and no publication target carries — so a Writes row naming
//     @workspaces/<role>, the runtime owner or a remote is refused by the registry, not by a list
//     kept here;
//   - every tool is one of the modes resources/orchestrator.json#helpers.tools permits, which is why
//     `git` stops at read and every mode that writes a checkout, operates a runtime, publishes to a
//     registry or resolves a secret is simply absent from that map;
//   - the mode is one of #helpers.modes (inline or isolated): there is no transcript to inherit,
//     because a helper is entered from the person and not from a chain.
// Everything else — Params ↔ Requirements, Steps ↔ Stops ↔ registry, Writes ↔ Outputs ↔
// templates/kinds, en ↔ vi — is the operator package's law read over the helper's own tables.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cellCodes, cellParams, cellAliases, isYes, kindOf } from './operator-md.mjs';
import { loadHelperPackages, HELPER_TABLES, writeAliasOf } from './helper-md.mjs';
import { checkDoneWhen, checkPrimaryOutput } from './validate-operator.mjs';
import { loadAliasRegistry, baseOf as baseOfIn } from './alias-registry.mjs';
import { loadDomains, DISPOSITIONS } from './errors-registry.mjs';

const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');
const FILES = ['helper.md', 'helper.vi.md', 'helper.json', 'errors.json', 'validate.mjs', 'self-test.mjs', 'brief.md'];
const FIRST_COLUMN = { reads: 'alias', writes: 'alias', requirements: 'field', steps: 'n', outputs: 'kind', stops: 'code' };

// The stop codes a helper may name beyond its own: the shared ones operators/errors.json publishes for
// every package. Their home stays that file; this only reads it.
async function sharedCodes(root) {
  const doc = JSON.parse(await readFile(path.join(root, 'operators', 'errors.json'), 'utf8'));
  return Object.fromEntries(Object.entries(doc.codes ?? {}).filter(([, e]) => (e.scope ?? []).includes('*')).map(([id, e]) => [id, { ...e, home: 'operators/errors.json' }]));
}

async function loadProfiles(root) {
  const dir = path.join(root, 'resources', 'agents', 'profiles');
  const profiles = {};
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
    const group = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    for (const [id, profile] of Object.entries(group.profiles ?? {})) profiles[id] = { ...profile, runtime: group.runtime };
  }
  return profiles;
}

export async function validateHelpers(root) {
  const errors = [];
  const packages = await loadHelperPackages(root);
  const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
  const law = orchestrator.helpers;
  if (!law) return { errors: ['resources/orchestrator.json: no helpers paragraph; the support layer has one home and this is it'], checked: 0 };
  const registry = await loadAliasRegistry(root);
  const aliases = registry.aliases;
  const baseOf = (alias) => baseOfIn(aliases, alias);
  const tools = JSON.parse(await readFile(path.join(root, 'resources', 'tools.json'), 'utf8')).tools ?? {};
  const profiles = await loadProfiles(root);
  const shared = await sharedCodes(root);
  const domains = await loadDomains(root);
  let checked = 0;

  for (const pkg of packages) {
    checked += 1;
    const id = pkg.manifest.id;
    const at = `helpers/${pkg.name}/helper.md`;
    for (const f of FILES) if (!existsSync(path.join(pkg.dir, f))) errors.push(`helpers/${pkg.name}/${f}: missing`);
    if (id !== pkg.name) errors.push(`helpers/${pkg.name}/helper.json: id ${id} is not the folder ${pkg.name}`);
    const op = pkg.en;
    if (!op) { errors.push(`${at}: missing`); continue; }
    if (op.id !== id) errors.push(`${at}: title ${op.id} must equal helper.json id ${id}`);
    for (const key of HELPER_TABLES) if (!op.tables[key]) errors.push(`${at}: no ${key} table`);
    if (HELPER_TABLES.some((k) => !op.tables[k])) continue;

    // The support law: profile, mode, tools.
    const r = pkg.manifest.resources ?? {};
    const profile = profiles[r.profile ?? law.defaultProfile];
    if (!profile) errors.push(`helpers/${pkg.name}/helper.json: resources.profile ${r.profile} is not a declared profile of resources/agents/profiles`);
    if (!law.modes.includes(r.mode)) errors.push(`helpers/${pkg.name}/helper.json: resources.mode ${r.mode} is not one of ${law.modes.join(', ')} (resources/orchestrator.json#helpers.modes); a helper is entered from the person, so there is no transcript to inherit`);
    const declaredTools = new Set(Object.keys(r.tools ?? {}));
    for (const [ref, mode] of Object.entries(r.tools ?? {})) {
      const key = /^@tools\/([a-z][a-z0-9-]*)$/.exec(ref)?.[1];
      if (!key || !tools[key]) { errors.push(`helpers/${pkg.name}/helper.json: ${ref} is not in resources/tools.json`); continue; }
      if (!tools[key].modes[mode]) errors.push(`helpers/${pkg.name}/helper.json: ${ref} mode ${mode} is not one of ${Object.keys(tools[key].modes).join(', ')}`);
      const permitted = law.tools?.[ref];
      if (!permitted) errors.push(`helpers/${pkg.name}/helper.json: ${ref} is not a tool the support layer holds; resources/orchestrator.json#helpers.tools names ${Object.keys(law.tools ?? {}).join(', ')}, and a helper that needs more has found an operator's job`);
      else if (!permitted.includes(mode)) errors.push(`helpers/${pkg.name}/helper.json: ${ref} mode ${mode} is not one of ${permitted.join(', ')} that the support layer holds (resources/orchestrator.json#helpers.tools)`);
      if (profile && !profile.permits?.[key]) errors.push(`helpers/${pkg.name}/helper.json: declares ${ref} but profile ${r.profile} does not permit it`);
    }
    if (!declaredTools.has('@tools/fileread')) errors.push(`helpers/${pkg.name}/helper.json: every helper reads its Reads aliases; declare @tools/fileread`);

    // Writes: the support write set, as alias/alias.json marks it.
    const writeBases = [];
    for (const row of op.tables.writes.rows) {
      const alias = cellAliases(row.alias)[0];
      if (!alias) { errors.push(`${at}: Writes row "${row.alias}" names no alias`); continue; }
      const base = baseOf(alias);
      if (!base) { errors.push(`${at}: Writes ${alias} is not registered in alias/alias.json`); continue; }
      if (aliases[base].helperWritable !== true) errors.push(`${at}: Writes ${alias} is not marked helperWritable in alias/alias.json; a helper prepares and tidies — it writes no product source route, no runtime and no publication target (resources/orchestrator.json#helpers.writes)`);
      if (writeBases.includes(base)) errors.push(`${at}: Writes declares ${base} twice`);
      writeBases.push(base);
    }
    const declaredWrites = pkg.manifest.writes;
    if (!Array.isArray(declaredWrites)) errors.push(`helpers/${pkg.name}/helper.json: writes must list the aliases the Writes table declares`);
    else if ([...declaredWrites].sort().join() !== [...writeBases].sort().join()) errors.push(`helpers/${pkg.name}/helper.json: writes ${declaredWrites.join(', ') || '—'} and the Writes table ${writeBases.join(', ') || '—'} are two lists of one thing`);

    // Reads: every alias registered, every required one used, nothing read that was not declared.
    const readBases = new Set();
    const requiredReads = new Set();
    const seen = new Set();
    for (const row of op.tables.reads.rows) {
      const alias = cellAliases(row.alias)[0];
      if (!alias) { errors.push(`${at}: Reads row "${row.alias}" names no alias`); continue; }
      const base = baseOf(alias);
      if (!base) errors.push(`${at}: Reads ${alias} is not registered in alias/alias.json`);
      if (seen.has(alias)) errors.push(`${at}: Reads ${alias} is declared twice`);
      seen.add(alias);
      if (base) { readBases.add(base); if (isYes(row.required)) requiredReads.add(base); }
    }

    // Params ↔ Requirements.
    const fields = new Map(op.tables.requirements.rows.map((row) => [unquote(row.field), row]));
    const usedFields = new Set();
    for (const s of op.tables.steps.rows) for (const p of cellParams(s.params)) { usedFields.add(p); if (!fields.has(p)) errors.push(`${at}:${s._line}: step ${s.n} reads param ${p}, which Requirements does not declare`); }
    for (const [f, row] of fields) if (!usedFields.has(f)) errors.push(`${at}:${row._line}: requirement ${f} is read by no step`);

    // Outputs: one file per kind, each under a Writes alias, each written by a step.
    const outputs = new Map();
    for (const row of op.tables.outputs.rows) {
      const kind = kindOf(row.kind); const file = unquote(row.file); const type = row.type.trim();
      if (outputs.has(kind)) errors.push(`${at}:${row._line}: output ${kind} is declared twice`);
      outputs.set(kind, { file, type });
      const parsed = writeAliasOf(file);
      const base = parsed ? baseOf(parsed.alias) : null;
      if (!base || !writeBases.includes(base)) errors.push(`${at}:${row._line}: output ${kind} is written to ${file}, which is under no Writes alias of this helper; a helper has no branch to write a response into and every output it leaves is addressed by the alias it sits under`);
      if (type === 'data' && !existsSync(path.join(root, 'templates', 'kinds', `${kind}.schema.json`))) errors.push(`${at}:${row._line}: output ${kind} is data but templates/kinds/${kind}.schema.json is missing`);
      if (type === 'md' && !existsSync(path.join(root, 'templates', 'kinds', `${kind}.contract.json`))) errors.push(`${at}:${row._line}: output ${kind} is md but templates/kinds/${kind}.contract.json is missing`);
      if (!['data', 'md', 'artifact'].includes(type)) errors.push(`${at}:${row._line}: output ${kind} type ${type} is not data, md or artifact`);
    }
    errors.push(...checkDoneWhen(at, op, new Set(outputs.keys())));
    errors.push(...checkPrimaryOutput(`helpers/${pkg.name}/helper.json`, at, pkg.manifest, op, new Set(outputs.keys())));

    // Steps: a procedure, verb-led, no longer than the support layer runs, reading and writing only
    // what the Reads and Writes tables declare.
    const written = new Set();
    const usedReads = new Set();
    if (op.tables.steps.rows.length > law.maxSteps) errors.push(`${at}: ${op.tables.steps.rows.length} steps, past resources/orchestrator.json#helpers.maxSteps ${law.maxSteps}`);
    op.tables.steps.rows.forEach((s, i) => {
      if (Number(s.n) !== i + 1) errors.push(`${at}:${s._line}: step ${s.n} is row ${i + 1}; a helper's steps are numbered in order`);
      const verb = String(s.step ?? '').trim().split(/\s+/)[0];
      if (!law.stepVerbs.includes(verb)) errors.push(`${at}:${s._line}: step ${s.n} opens with "${verb}", which resources/orchestrator.json#helpers.stepVerbs does not list (${law.stepVerbs.join(', ')}); a Steps row states an act, not a state`);
      for (const a of [...cellAliases(s.reads), ...cellAliases(s.writes)]) {
        if (a.startsWith('@tools/')) { if (!aliases[a]) errors.push(`${at}:${s._line}: step ${s.n} names ${a}, which resources/tools.json does not define`); else if (!declaredTools.has(a)) errors.push(`${at}:${s._line}: step ${s.n} calls ${a}, which helper.json resources.tools does not declare`); continue; }
        const base = baseOf(a) ?? a;
        if (cellAliases(s.writes).includes(a)) { if (!writeBases.includes(base)) errors.push(`${at}:${s._line}: step ${s.n} writes ${a}, which the Writes table does not declare`); }
        else { usedReads.add(base); if (!readBases.has(base)) errors.push(`${at}:${s._line}: step ${s.n} reads ${a}, which the Reads table does not declare`); }
      }
      for (const m of String(s.writes ?? '').matchAll(/`([a-z][a-z0-9-]*)`/g)) if (outputs.has(m[1])) written.add(m[1]);
    });
    for (const rb of requiredReads) if (!usedReads.has(rb)) errors.push(`${at}: Steps never read required ${rb}`);
    for (const kind of outputs.keys()) if (!written.has(kind)) errors.push(`${at}: output ${kind} is written by no step`);

    // Steps ↔ Stops ↔ the registry: this helper's own codes plus the shared ones.
    const local = JSON.parse(await readFile(path.join(pkg.dir, 'errors.json'), 'utf8'));
    const localAt = `helpers/${pkg.name}/errors.json`;
    if (local.schemaVersion !== 9) errors.push(`${localAt}: schemaVersion must be 9`);
    const codes = { ...shared };
    for (const [code, entry] of Object.entries(local.codes ?? {})) {
      if (codes[code]) { errors.push(`${localAt}: ${code} is already defined in ${codes[code].home}; a code with two homes drifts`); continue; }
      if (!/^[A-Z][A-Z0-9_]+$/.test(code)) errors.push(`${localAt}: code ${code} must be UPPER_SNAKE`);
      if (!DISPOSITIONS.has(entry.disposition)) errors.push(`${localAt}: ${code} disposition must be terminate or fallback`);
      if (!domains.has(entry.domain)) errors.push(`${localAt}: ${code} domain ${entry.domain} is not a routing domain`);
      for (const key of ['meaning', 'resume']) if (!entry[key]?.en || !entry[key]?.vi) errors.push(`${localAt}: ${code} needs ${key}.en and ${key}.vi`);
      codes[code] = { ...entry, home: localAt };
    }
    const stops = new Map(op.tables.stops.rows.map((row) => [unquote(row.code), row]));
    const usedCodes = new Set();
    for (const s of op.tables.steps.rows) for (const c of cellCodes(s.stops)) { usedCodes.add(c); if (!stops.has(c)) errors.push(`${at}:${s._line}: step ${s.n} stops with ${c}, which the Stops table omits`); }
    for (const [c, row] of stops) {
      if (!usedCodes.has(c)) errors.push(`${at}:${row._line}: stop ${c} is emitted by no step`);
      const entry = codes[c];
      if (!entry) { errors.push(`${at}:${row._line}: stop ${c} is in no errors registry`); continue; }
      if (row.disposition.trim() !== entry.disposition) errors.push(`${at}:${row._line}: stop ${c} says ${row.disposition.trim()} but ${entry.home} says ${entry.disposition}`);
    }
    for (const c of Object.keys(local.codes ?? {})) if (!stops.has(c)) errors.push(`${localAt}: ${c} is defined for ${id} but its Stops table omits it`);
    if (!cellCodes(op.tables.steps.rows[0]?.stops ?? '').includes('INVALID_INPUT')) errors.push(`${at}: step 1 must be the gate and stop with INVALID_INPUT`);

    // en ↔ vi.
    const vi = pkg.vi;
    if (!vi) { errors.push(`helpers/${pkg.name}/helper.vi.md: missing`); continue; }
    const viAt = `helpers/${pkg.name}/helper.vi.md`;
    if (vi.id !== id) errors.push(`${viAt}: title must be ${id}`);
    const viDone = checkDoneWhen(viAt, vi, null);
    errors.push(...viDone);
    for (const key of HELPER_TABLES) {
      const a = op.tables[key]; const b = vi.tables[key];
      if (!b) { errors.push(`${viAt}: no ${key} table`); continue; }
      if (a.rows.length !== b.rows.length) { errors.push(`${viAt}: ${key} has ${b.rows.length} rows, English has ${a.rows.length}`); continue; }
      const first = FIRST_COLUMN[key];
      a.rows.forEach((ra, i) => {
        const rb = b.rows[i];
        if (unquote(ra[first]) !== unquote(rb[first])) errors.push(`${viAt}:${rb._line}: ${key} row ${i + 1} is ${unquote(rb[first])}, English has ${unquote(ra[first])}`);
        if (key === 'steps') {
          if (cellCodes(ra.stops).join() !== cellCodes(rb.stops).join()) errors.push(`${viAt}:${rb._line}: step ${ra.n} stop codes differ from English`);
          if (cellParams(ra.params).join() !== cellParams(rb.params).join()) errors.push(`${viAt}:${rb._line}: step ${ra.n} params differ from English`);
          if (cellAliases(ra.reads).join() !== cellAliases(rb.reads).join()) errors.push(`${viAt}:${rb._line}: step ${ra.n} reads differ from English`);
        }
        if (key === 'stops' && ra.disposition.trim() !== rb.disposition.trim()) errors.push(`${viAt}:${rb._line}: ${unquote(ra.code)} disposition differs from English`);
        if (key === 'outputs' && (ra.type.trim() !== rb.type.trim() || unquote(ra.file) !== unquote(rb.file))) errors.push(`${viAt}:${rb._line}: output ${unquote(ra.kind)} file or type differs from English`);
        if (key === 'requirements' && unquote(ra.default) !== unquote(rb.default)) errors.push(`${viAt}:${rb._line}: requirement ${unquote(ra.field)} default differs from English`);
      });
    }
  }
  return { errors, checked };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, checked } = await validateHelpers(root);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`helpers closed: ${checked} helper.md packages\n`);
}
