/**
 * Lane v6-2 scratch tool #10: assemble knowledge/grammars/common/DNA.yaml from the authored prose
 * header, the machine-measured blocks, and the authored gaps — no table is typed by hand, so the file
 * and the measurement cannot disagree.
 */
import fs from 'node:fs';
import path from 'node:path';

const scratch = 'D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/scratch';
const target = 'D:/Repositories/starci-academy-backend/.claude/knowledge/grammars/common/DNA.yaml';
const read = file => fs.readFileSync(path.join(scratch, file), 'utf8').replace(/\r\n/g, '\n');

const header = read('v6-2-header.yaml');
const tokens = read('v6-2-tokens-block.txt');
const renderers = read('v6-2-renderers-final.txt');
const gaps = read('v6-2-gaps.yaml');
const blocks = read('v6-2-dna-blocks.txt').split('\n');
const from = blocks.findIndex(l => l === 'sourceDigests:');
const digests = blocks.slice(from + 1)
  .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('classUniverse:'))
  .map(l => `  ${l}`);

const marker = 'identity:\n';
const at = header.indexOf(marker);
if (at < 0) throw Error('header has no identity: key');
const provenanceDigests = ['  digests:', ...digests, ''].join('\n');
const assembled = [
  header.slice(0, at) + provenanceDigests + header.slice(at),
  tokens.trimEnd(),
  '',
  renderers.trimEnd(),
  '',
  gaps.trimEnd(),
  '',
].join('\n');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, assembled.replace(/\n{3,}/g, '\n\n'));
const lines = assembled.split('\n');
console.log(`wrote ${path.relative('D:/Repositories/starci-academy-backend/.claude', target)}: ${lines.length} lines, ${Buffer.byteLength(assembled)} bytes`);
console.log(`top-level keys in order: ${lines.filter(l => /^[a-zA-Z][a-zA-Z0-9]*:$/.test(l)).map(l => l.slice(0, -1)).join(', ')}`);
