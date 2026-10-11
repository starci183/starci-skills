// A catalog verb that declares `effect: read` does not open a store for writing: the body of its export (the function the dispatcher
// calls) neither opens a ledger or the machine store nor writes a file nor takes a host lock. The eleven verbs below open no ledger at
// all (they read Docker, Orca, the Task Scheduler, a health probe or the product tree), so there is no ledger connection to make read-only;
// the spec keeps that true when one of them is edited.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadCatalog } from '../../scripts/cli/catalog.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const STORE_WRITERS = [/\bopenLedger\(/, /\bopenMachine\(/, /\bwithMachine\(/, /\bunderHostLock\(/, /\bwriteFileSync\(/, /\bappendFileSync\(/, /\.write\./, /\brecordMachine/];
const READ_VERBS = ['check run', 'docker ps', 'harness status', 'lint run', 'supabase status', 'task list', 'task show', 'typecheck run', 'worker list', 'worker read', 'worker show'];

/** Every module-implemented catalog verb with effect: read: [{name, module, export}]. */
function readVerbs() {
  const found = [];
  for (const { group, verbs } of loadCatalog(ROOT).groups) {
    for (const command of verbs) {
      if (command.effect === 'read' && command.impl?.module) found.push({ name: `${group} ${command.verb}`, module: command.impl.module, export: command.impl.export });
    }
  }
  return found;
}

/** The text of `export [async] function <name>` up to its closing brace at column 0; follows a one-level re-export to the module that owns it. */
function bodyOf(file, name, depth = 0) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const start = new RegExp(String.raw`export (?:async )?function ${name}\b`).exec(text);
  if (start) return text.slice(start.index, text.indexOf('\n}', start.index) + 2);
  const reexport = new RegExp(String.raw`export \{[^}]*\b${name}\b[^}]*\} from '([^']+)'`).exec(text);
  assert.ok(reexport && depth < 3, `${file} defines or re-exports ${name}`);
  return bodyOf(path.posix.join(path.posix.dirname(file), reexport[1]), name, depth + 1);
}

test('the effect: read module verbs are the eleven this spec names', () => {
  assert.deepEqual(readVerbs().map((verb) => verb.name).sort(), [...READ_VERBS].sort());
});

test('no effect: read verb opens a store for writing in the function the dispatcher calls', () => {
  for (const verb of readVerbs()) {
    const body = bodyOf(verb.module, verb.export);
    for (const writer of STORE_WRITERS) assert.doesNotMatch(body, writer, `${verb.name} (${verb.module} ${verb.export}) matches ${writer}`);
  }
});
