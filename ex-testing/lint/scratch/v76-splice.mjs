import fs from 'node:fs';

// Splice the mechanically-elided refusal lines (v76-remaining-elided.txt) into the report's
// "Remaining gate refusals observed" block, so the quoted lines match the gate log word for word.
const file = process.argv[2];
const linesFile = process.argv[3];
const head = '## Remaining gate refusals observed (verbatim)';
const text = fs.readFileSync(file, 'utf8');
const at = text.indexOf(head);
if (at < 0) throw new Error('section heading not found');
const open = text.indexOf('```', at);
const close = text.indexOf('```', open + 3);
const body = fs.readFileSync(linesFile, 'utf8').replace(/\s+$/, '');
const rebuilt = text.slice(0, open + 3) + '\n' + body + '\n' + text.slice(close);
fs.writeFileSync(file, rebuilt);
console.log(`spliced ${body.split('\n').length} lines into ${file}`);
