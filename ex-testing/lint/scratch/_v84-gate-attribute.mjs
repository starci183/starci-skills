// v8-4 scratch: attribute the base-gate delta between two runs to files/codes (lane concurrency discipline).
import fs from 'node:fs';

const text = fs.readFileSync('ex-testing/lint/scratch/_v84/gate-diff.txt', 'utf8').replace(/\r/g, '');
const deltaLines = text.split('\n').filter(line => /^\s*[+-]\s+(REFUSED|WARN)\s/.test(line));
const codes = new Map();
const files = new Map();
for (const line of deltaLines) {
  const code = /\[([A-Z_]+)\]/.exec(line)?.[1] ?? '(no code)';
  const file = /^\s*[+-]\s+(REFUSED|WARN)\s+(\S+)/.exec(line)?.[2] ?? '(no file)';
  codes.set(code, (codes.get(code) ?? 0) + 1);
  files.set(file.replaceAll('\\', '/'), (files.get(file) ?? 0) + 1);
}
console.log(`delta lines: ${deltaLines.length}`);
console.log('by code: ' + [...codes.entries()].map(([code, n]) => `${code}=${n}`).join(', '));
console.log('by tree: ' + [...new Set([...files.keys()].map(f => f.split('/')[1]))].join(', '));
console.log(`distinct files: ${files.size}`);
for (const file of [...files.keys()].sort()) console.log('   ' + file);
