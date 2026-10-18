// lcov-merge.mjs - the lcov reports of the sharded unit run merged into one (`starci app coverage merge`, the coverage job of the managed CI). Each shard of
// `npm test -- --shard=i/N` writes its own lcov over the whole collectCoverageFrom scope (a file no test of that shard loads is a record of zeros), so the
// merge sums every line, function and branch hit by its identity across the shards and writes ONE record per source file, with the summaries recomputed:
// the coverage proof (`starci app check --coverage-from`), the Codecov upload and the Sonar import then read the one be/coverage/lcov.info they always read.
// Pure over the texts; the file walk is lcovFilesUnder.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { addHits as add } from './rules/coverage-below.mjs';

const count = (value) => (/^\d+$/.test(value) ? Number(value) : 0);

function recordOf(records, source) {
  if (!records.has(source)) records.set(source, { lines: new Map(), fnLines: new Map(), fnHits: new Map(), branches: new Map() });
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
    if (parts.length === 4) add(record.branches, parts.slice(0, 3).join(','), parts[3] === '-' ? 0 : count(parts[3]));
  }
}

/** Every record of every text, merged by source file (SF) and identity. */
function parseAll(texts) {
  const records = new Map();
  for (const text of texts) {
    let current = null;
    for (const raw of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
      const line = raw.trim();
      if (line === 'end_of_record') { current = null; continue; }
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const tag = line.slice(0, colon);
      const value = line.slice(colon + 1);
      if (tag === 'SF') current = recordOf(records, value);
      else if (current) dataLine(current, tag, value);
    }
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
