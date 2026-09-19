// v11-1 lane: collapse features/**/ac/<slug>/index.yaml into the parent record's
// `acceptance:` list as {id: <former-ac-id>, given, when, then} entries (the compact
// format scripts/example-ownership.mjs's INLINE_CRITERION_FIELDS defines); remap
// ac.* refs to `parent#<former-ac-id>`; re-pin sibling evidence recordDigests.
// Text surgery only - comments and byte layout outside edited fields are preserved.
// Usage: node v11-1-collapse.mjs [--apply]   (default: dry-run report)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml, stringifyYaml} from '../../../core/yaml.mjs';

const root = path.resolve(process.cwd());
const workRoot = path.join(root, 'examples/todo-app-backend/.starciwork');
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = f => path.relative(workRoot, f).replaceAll('\\', '/');
const sha256File = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const warns = [];
const edits = []; // {file, text}

/** Entry fragment: `  - id: ac.x.y\n    given: ...` via stringifyYaml for safe quoting. */
function acEntry(ac) {
  const body = stringifyYaml({id: ac.id, given: ac.data.given, when: ac.data.when, then: ac.data.then}).trimEnd();
  return body.split('\n').map((l, i) => (i === 0 ? '  - ' + l : '    ' + l)).join('\n');
}

/** Bump a change block (flow or block form): rev+1, kind editorial, at NOW, append reason note. */
function bumpChange(text, note, fileLabel) {
  const m = /(^|\n)change:[ \t]*(\{)?/.exec(text);
  if (!m) { warns.push(`${fileLabel}: no change block found - left unchanged`); return text; }
  const start = m.index + (m[1] === '\n' ? 1 : 0);
  if (m[2] === '{') {
    const i = text.indexOf('{', start + 'change:'.length);
    let depth = 0, inQ = false, end = -1;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inQ) { if (c === '"') inQ = false; continue; }
      if (c === '"') { inQ = true; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) { warns.push(`${fileLabel}: change flow map never closes`); return text; }
    let flow = text.slice(i, end + 1);
    const revM = /rev:\s*(\d+)/.exec(flow);
    const newRev = revM ? Number(revM[1]) + 1 : 1;
    const noteText = `rev ${newRev} (v11 ac-collapse): ${note}`;
    if (revM) flow = flow.replace(/rev:\s*\d+/, `rev: ${newRev}`);
    if (/kind:\s*[a-z]+/.test(flow)) flow = flow.replace(/kind:\s*[a-z]+/, 'kind: editorial');
    flow = flow.replace(/at:\s*[^,}]+/, `at: ${NOW}`);
    if (/reason:\s*"/.test(flow)) {
      const ri = flow.indexOf('reason:');
      const q0 = flow.indexOf('"', ri);
      let q1 = -1;
      for (let j = flow.length - 1; j > q0; j--) if (flow[j] === '"') { q1 = j; break; }
      if (q1 > q0) flow = flow.slice(0, q1) + ' ' + noteText + flow.slice(q1);
      else warns.push(`${fileLabel}: reason quote not closed`);
    } else {
      flow = flow.slice(0, -1) + `, reason: "${noteText}"}`;
    }
    return text.slice(0, i) + flow + text.slice(end + 1);
  }
  // block form
  const lines = text.slice(start).split('\n');
  const head = lines[0];
  let j = 1;
  while (j < lines.length && (lines[j].startsWith('  ') || lines[j].trim() === '')) j++;
  const block = lines.slice(1, j); // body only; head (the `change:` line) is emitted separately
  const revIdx = block.findIndex(l => /^\s+rev:\s*\d+/.test(l));
  const newRev = revIdx >= 0 ? Number(/rev:\s*(\d+)/.exec(block[revIdx])[1]) + 1 : 1;
  if (revIdx >= 0) block[revIdx] = block[revIdx].replace(/rev:\s*\d+/, `rev: ${newRev}`);
  const kindIdx = block.findIndex(l => /^\s+kind:/.test(l));
  if (kindIdx >= 0) block[kindIdx] = block[kindIdx].replace(/kind:\s*[a-z]+/, 'kind: editorial');
  const atIdx = block.findIndex(l => /^\s+at:/.test(l));
  if (atIdx >= 0) block[atIdx] = block[atIdx].replace(/at:\s*.+/, `at: ${NOW}`);
  const noteText = `rev ${newRev} (v11 ac-collapse) - ${note.replace(/: /g, ' - ')}`;
  const reasonIdx = block.findIndex(l => /^\s+reason:/.test(l));
  if (reasonIdx >= 0) {
    const rline = block[reasonIdx];
    const valueStart = rline.indexOf('reason:') + 'reason:'.length;
    const after = rline.slice(valueStart).trimStart();
    if (after.startsWith('"')) {
      // double-quoted scalar spanning lines: insert inside the closing quote
      let done = false;
      for (let k = reasonIdx; k < block.length && !done; k++) {
        const line = block[k];
        const from = k === reasonIdx ? rline.indexOf('"', valueStart) + 1 : 0;
        for (let c = line.length - 1; c >= from && !done; c--) {
          if (line[c] === '"' && line[c - 1] !== '\\') {
            block[k] = line.slice(0, c) + ` rev ${newRev} (v11 ac-collapse): ${note}` + line.slice(c);
            done = true;
          }
        }
      }
      if (!done) warns.push(`${fileLabel}: reason quote not closed - note not appended`);
    } else {
      // plain or folded scalar: insert a continuation line before the scalar's extent ends
      const rIndent = /^\s*/.exec(rline)[0].length;
      let end = block.length;
      for (let k = reasonIdx + 1; k < block.length; k++) {
        if (block[k].trim() !== '' && /^\s*/.exec(block[k])[0].length <= rIndent) { end = k; break; }
      }
      block.splice(end, 0, '    ' + noteText);
    }
  } else {
    block.push(`  reason: "${`rev ${newRev} (v11 ac-collapse): ${note}`}"`);
  }
  return text.slice(0, start) + head + '\n' + block.join('\n') + '\n' + lines.slice(j).join('\n');
}

// ---------- collect ac records ----------
const acFiles = walk(workRoot).filter(f => /\/ac\/[^/]+\/index\.yaml$/.test(f.replaceAll('\\', '/')));
const acByParent = new Map(); // parentDir -> [{slug, id, data}]
for (const f of acFiles) {
  const data = parseYaml(fs.readFileSync(f, 'utf8'));
  const slug = path.basename(path.dirname(f));
  const parentDir = path.dirname(path.dirname(path.dirname(f)));
  if (!acByParent.has(parentDir)) acByParent.set(parentDir, []);
  acByParent.get(parentDir).push({slug, id: data.id, data});
}
// verify computed parent ids and build ref map acId -> parentId#acId
const acIdToNew = new Map();
for (const [parentDir, list] of acByParent) {
  const parent = parseYaml(fs.readFileSync(path.join(parentDir, 'index.yaml'), 'utf8'));
  for (const a of list) {
    const segs = a.id.split('.');
    const computedParent = 'br.' + segs.slice(1, -1).join('.');
    if (computedParent !== parent.id) warns.push(`${a.id}: computed parent ${computedParent} != actual ${parent.id}`);
    if (segs.at(-1) !== a.slug) warns.push(`${a.id}: last id segment != dir slug ${a.slug}`);
    acIdToNew.set(a.id, `${parent.id}#${a.id}`);
  }
}
console.log(`ac records: ${acFiles.length}, parents: ${acByParent.size}`);

// ---------- phase B1: rewrite parents' acceptanceCriteria -> acceptance ----------
const touchedDirs = new Set();
for (const [parentDir, list] of acByParent) {
  const file = path.join(parentDir, 'index.yaml');
  const text = fs.readFileSync(file, 'utf8');
  const parent = parseYaml(text);
  const slugs = parent.acceptanceCriteria;
  const bySlug = new Map(list.map(a => [a.slug, a]));
  let entries;
  if (Array.isArray(slugs)) {
    entries = slugs.map(s => {
      const a = bySlug.get(s);
      if (!a) { warns.push(`${parent.id}: acceptanceCriteria slug "${s}" has no ac file - kept as scalar`); return `  - ${s}`; }
      return acEntry(a);
    });
    for (const a of list) if (!slugs.includes(a.slug)) { warns.push(`${parent.id}: ac ${a.slug} not listed in acceptanceCriteria - appended`); entries.push(acEntry(a)); }
  } else {
    warns.push(`${parent.id}: no acceptanceCriteria array - adding acceptance:`);
    entries = list.map(acEntry);
  }
  let replaced;
  const flowM = /acceptanceCriteria:[ \t]*\[[^\]]*\]/.exec(text);
  if (flowM) {
    replaced = text.slice(0, flowM.index) + 'acceptance:\n' + entries.join('\n') + text.slice(flowM.index + flowM[0].length);
  } else {
    const blockM = /acceptanceCriteria:\n((?:[ \t]+-[ \t][^\n]*\n?)+)/.exec(text);
    if (!blockM) { warns.push(`${parent.id}: acceptanceCriteria form unrecognized`); continue; }
    replaced = text.slice(0, blockM.index) + 'acceptance:\n' + entries.join('\n') + '\n' + text.slice(blockM.index + blockM[0].length);
  }
  const note = `acceptanceCriteria renamed to acceptance and now carries each criterion's id, given, when and then inline from the retired ac/ sub-records; refs to the old ac ids remap to ${parent.id}#<former-ac-id>. Encoding change only, no semantic change.`;
  replaced = bumpChange(replaced, note, parent.id);
  let check;
  try { check = parseYaml(replaced); }
  catch (e) {
    warns.push(`${parent.id}: generated YAML unparseable - skipped`);
    fs.writeFileSync(path.join(root, 'ex-testing/lint/scratch/v11-1-debug-' + parent.id.replaceAll('.', '_') + '.yaml'), replaced);
    continue;
  }
  if (check.id !== parent.id) { warns.push(`${parent.id}: rewrite broke id`); continue; }
  if (!Array.isArray(check.acceptance) || check.acceptance.length !== entries.length) { warns.push(`${parent.id}: acceptance list length mismatch after rewrite`); continue; }
  edits.push({file, text: replaced});
  touchedDirs.add(parentDir);
}

// ---------- phase B2: remap ac refs in every other yaml ----------
// Remap only structural whole-scalar positions. Quoted/embedded occurrences inside
// command:/observation: transcripts stay verbatim - they record the jest -t filters
// that actually ran, and the spec names in src/ still carry the ac.* strings.
const remapText = (text) => {
  let out = text;
  for (const [oldId, newId] of acIdToNew) {
    const esc = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`(^|\\n)(\\s*(?:-\\s*)?id:[ \\t]*)${esc}(?=[ \\t]*\\n|$)`, 'g'), `$1$2${newId}`)
      .replace(new RegExp(`(^|\\n)(\\s*(?:-\\s*)?record:[ \\t]*)${esc}(?=[ \\t]*\\n|$)`, 'g'), `$1$2${newId}`)
      .replace(new RegExp(`(^|\\n)(\\s*-[ \\t]*)${esc}(?=[ \\t]*\\n|$)`, 'g'), `$1$2${newId}`)
      .replace(new RegExp(`(^|\\n)(\\s*(?:-\\s*)?id:[ \\t]*)"${esc}"(?=[ \\t]*\\n|$)`, 'g'), `$1$2"${newId}"`)
      .replace(new RegExp(`([\\[:,][ \\t]*)"${esc}"(?=[ \\t]*[,\\]\\n]|$)`, 'g'), `$1"${newId}"`);
  }
  return out;
};
for (const f of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
  const r = rel(f);
  if (r.startsWith('_derived/')) continue;           // regenerated by example-derive --write
  if (/\/ac\/[^/]+\/index\.yaml$/.test(r)) continue;   // deleted below
  if (edits.some(e => e.file === f)) continue;         // parents already handled
  const orig = fs.readFileSync(f, 'utf8');
  const next = remapText(orig);
  if (next !== orig) {
    edits.push({file: f, text: next});
    if (r.endsWith('/index.yaml')) touchedDirs.add(path.dirname(f));
  }
}

// ---------- phase B3: prose remaps (criterion references, not jest test names) ----------
const proseRemaps = [
  ['features/audit/data/log-line/index.yaml', [[/ac\.task\.delete\.final\.stays-gone/g, 'br.task.delete.final#ac.task.delete.final.stays-gone']]],
  ['features/audit/decision/deleted-task-target/index.yaml', [
    [/ac\.task\.delete\.final\.stays-gone/g, 'br.task.delete.final#ac.task.delete.final.stays-gone'],
    [/ac\.audit\.append-only\.chain-detects-tamper/g, 'br.audit.append-only#ac.audit.append-only.chain-detects-tamper'],
  ]],
  ['features/plan/decision/downgrade/policy/index.yaml', [[/ac\.plan\.caps\.limit\.refuses-over-cap/g, 'br.plan.caps.limit#ac.plan.caps.limit.refuses-over-cap']]],
  ['features/plan/br/downgrade/freeze/index.yaml', [[/as ac\.plan\.caps\.limit refuses/g, 'as br.plan.caps.limit refuses']]],
];

// ---------- report / apply ----------
console.log('\nPLANNED EDITS:', edits.length + proseRemaps.length, 'files +', acFiles.length, 'ac deletions');
for (const e of edits) console.log('  edit', rel(e.file));
for (const [f] of proseRemaps) console.log('  prose', f);
if (warns.length) { console.log('\nWARNINGS:'); for (const w of warns) console.log('  !', w); }
if (!APPLY) { console.log('\nDRY RUN - pass --apply to write'); process.exit(0); }

for (const e of edits) fs.writeFileSync(e.file, e.text);
for (const [file, pairs] of proseRemaps) {
  const abs = path.join(workRoot, file);
  let text = fs.readFileSync(abs, 'utf8');
  for (const [re, to] of pairs) text = text.replace(re, to);
  fs.writeFileSync(abs, text);
  touchedDirs.add(path.dirname(abs));
}
for (const f of acFiles) fs.rmSync(path.dirname(f), {recursive: true});
const acDirs = new Set(acFiles.map(f => path.dirname(path.dirname(f))));
for (const d of acDirs) if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
let repinned = 0;
for (const dir of touchedDirs) {
  const ev = path.join(dir, 'evidence.yaml');
  const idx = path.join(dir, 'index.yaml');
  if (!fs.existsSync(ev) || !fs.existsSync(idx)) continue;
  const text = fs.readFileSync(ev, 'utf8');
  if (!/recordDigest:\s*[0-9a-f]{64}/.test(text)) continue;
  fs.writeFileSync(ev, text.replace(/recordDigest:\s*[0-9a-f]{64}/, `recordDigest: ${sha256File(idx)}`));
  repinned++;
}
console.log(`applied: ${edits.length + proseRemaps.length} files edited, ${acFiles.length} ac records deleted, ${repinned} evidence digests re-pinned`);
