/** v7-14: pull the gate lines that are not one of the known bulk classes, so none is silently unclassified. */
import fs from 'node:fs';
const file = process.argv[2] ?? 'ex-testing/lint/scratch/v7-14/gate-final.txt';
const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
const known = /RENDER_CHECK_FAILED|CODE_DIGEST_STALE|recordDigest /;
for (const l of lines.filter(x => !known.test(x) && !/^\d+ record\(s\)/.test(x))) console.log(l);
