// lcov-merge.mjs - the lcov reports of the sharded unit run merged into one (`starci app coverage merge`, the coverage job of the managed CI). Each shard of
// `npm test -- --shard=i/N` writes its own lcov over the whole collectCoverageFrom scope, so the merge sums every line, function and branch hit by its
// identity across the shards and writes ONE record per source file, with the summaries recomputed.
// A record of zeros (no line, function or branch hit) is the placeholder a shard writes for a file none of its tests loaded: jest instruments it on its own
// (babel-istanbul), so its function names and branch ids are not the ones of the shard that ran it (v8), and summing them would add phantom uncovered
// entries. Such a placeholder is dropped whenever another report holds a record of the file with a hit; a file that is a placeholder everywhere keeps one,
// so it stays uncovered and the proof refuses it. Branch ids are not stable either: the v8 provider numbers a file's blocks in the order it met them, and a
// shard that ran fewer functions numbers them differently. A branch is therefore keyed by its line and its ordinal among the blocks of that line (BRDA
// <line>,<ordinal>,<branch>), and a record that loaded the file without calling any of its functions brings its lines and functions but not its branches
// when another report called them. The coverage proof (`starci app check --coverage-from`), the Codecov upload and the Sonar import then read
// the one be/coverage/lcov.info they always read. Pure over the texts; the file walk is lcovFilesUnder.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { addHits as add } from './rules/coverage-below.mjs';

const BOM = String.fromCodePoint(0xfeff);
const count = (value) => (/^\d+$/.test(value) ? Number(value) : 0);

function recordOf(records, source) {
  if (!records.has(source)) records.set(source, { lines: new Map(), fnLines: new Map(), fnHits: new Map(), branches: new Map(), rawBranches: [] });
  return records.get(source);
}

/** Function data: FN:<line>[,<end>],<name> declares, FNDA:<hits>,<name> counts (a name may hold commas). */
function functionLine(record, tag, value) {
  const at = value.indexOf(',');
  if (at < 0) return;
  if (tag === 'FN') {
    let name = value.slice(at + 1);
    let line = value.slice(0, at);
    if (/^\d+,/.test(name)) { line = `${line},${name.slice(0, name.indexOf(','))}`; name = name.slice(name.indexOf(',') + 1); }
    if (!record.fnLines.has(name)) record.fnLines.set(name, line);
    if (!record.fnHits.has(name)) record.fnHits.set(name, 0);
  } else add(record.fnHits, value.slice(at + 1), count(value.slice(0, at)));
}

function dataLine(record, tag, value) {
  if (tag === 'DA') {
    const [line, hits] = value.split(',');
    add(record.lines, Number(line), count(hits ?? ''));
  } else if (tag === 'FN' || tag === 'FNDA') functionLine(record, tag, value);
  else if (tag === 'BRDA') {
    const parts = value.split(',');
    if (parts.length === 4) record.rawBranches.push({ line: Number(parts[0]), block: Number(parts[1]), branch: Number(parts[2]), hits: parts[3] === '-' ? 0 : count(parts[3]) });
  }
}

/** The branches of a record keyed by line and the ordinal of their block on that line: stable across shards that numbered blocks differently. */
function keyBranches(record) {
  const blocksByLine = new Map();
  for (const entry of [...record.rawBranches].sort((a, b) => a.block - b.block || a.branch - b.branch)) {
    const blocks = blocksByLine.get(entry.line) ?? [];
    if (!blocks.includes(entry.block)) blocks.push(entry.block);
    blocksByLine.set(entry.line, blocks);
    add(record.branches, `${entry.line},${blocks.indexOf(entry.block)},${entry.branch}`, entry.hits);
  }
  return record;
}

/** The records of one text by source file (a source repeated inside one text merges into one record). */
function recordsOfText(text) {
  const records = new Map();
  let current = null;
  const body = String(text).startsWith(BOM) ? String(text).slice(1) : String(text);
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === 'end_of_record') { current = null; continue; }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const tag = line.slice(0, colon);
    const value = line.slice(colon + 1);
    if (tag === 'SF') current = recordOf(records, value);
    else if (current) dataLine(current, tag, value);
  }
  for (const record of records.values()) keyBranches(record);
  return records;
}

const anyHit = (map) => [...map.values()].some((hits) => hits > 0);
/** A record no test touched: no line, function or branch hit (the placeholder of a shard that never loaded the file). */
const placeholder = (record) => !anyHit(record.lines) && !anyHit(record.fnHits) && !anyHit(record.branches);

function mergeInto(target, record, { branches = true } = {}) {
  for (const [line, hits] of record.lines) add(target.lines, line, hits);
  for (const [name, line] of record.fnLines) if (!target.fnLines.has(name)) target.fnLines.set(name, line);
  for (const [name, hits] of record.fnHits) add(target.fnHits, name, hits);
  if (branches) for (const [branch, hits] of record.branches) add(target.branches, branch, hits);
}

/** Every record of every text merged by source file (SF) and identity; a placeholder counts only when no report touched the file. */
function parseAll(texts) {
  const bySource = new Map();
  for (const text of texts) for (const [source, record] of recordsOfText(text)) bySource.set(source, [...(bySource.get(source) ?? []), record]);
  const records = new Map();
  for (const [source, list] of bySource) {
    const touched = list.filter((record) => !placeholder(record));
    const target = recordOf(records, source);
    const called = touched.some((record) => anyHit(record.fnHits));
    // A record that loaded the file but called none of its functions keeps only its lines and functions when another record called them.
    for (const record of touched.length ? touched : list.slice(0, 1)) mergeInto(target, record, { branches: !called || anyHit(record.fnHits) });
  }
  return records;
}

const branchOrder = (a, b) => a.split(',').map(Number).reduce((order, part, index) => order || part - Number(b.split(',')[index]), 0);

function serialize(source, record) {
  const out = ['TN:', `SF:${source}`];
  const functions = [...record.fnLines.keys()].sort((a, b) => Number(record.fnLines.get(a).split(',')[0]) - Number(record.fnLines.get(b).split(',')[0]) || byCodeUnit(a, b));
  for (const name of functions) out.push(`FN:${record.fnLines.get(name)},${name}`);
  for (const name of functions) out.push(`FNDA:${record.fnHits.get(name) ?? 0},${name}`);
  out.push(`FNF:${functions.length}`, `FNH:${functions.filter((name) => (record.fnHits.get(name) ?? 0) > 0).length}`);
  const lines = [...record.lines.keys()].sort((a, b) => a - b);
  for (const line of lines) out.push(`DA:${line},${record.lines.get(line)}`);
  out.push(`LF:${lines.length}`, `LH:${lines.filter((line) => record.lines.get(line) > 0).length}`);
  const branches = [...record.branches.keys()].sort(branchOrder);
  for (const branch of branches) out.push(`BRDA:${branch},${record.branches.get(branch)}`);
  out.push(`BRF:${branches.length}`, `BRH:${branches.filter((branch) => record.branches.get(branch) > 0).length}`, 'end_of_record');
  return out.join('\n');
}

/** One lcov text of the merged `texts`: a record per source file, sorted by path, hits summed by line, function name and branch identity. */
export function mergeLcov(texts) {
  const records = parseAll(texts);
  return [...records.keys()].sort(byCodeUnit).map((source) => serialize(source, records.get(source))).join('\n') + (records.size ? '\n' : '');
}

/** The lcov files a path names: the file itself, or every `lcov.info` below a directory (sorted). */
export function lcovFilesUnder(target) {
  if (!fs.statSync(target).isDirectory()) return [target];
  return fs.readdirSync(target, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && entry.name === 'lcov.info')
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name)).sort(byCodeUnit);
}
