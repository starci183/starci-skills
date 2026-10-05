// The bounded JSON evidence reader used by loop and mechanism judgments.
import fs from 'node:fs';
import { attachedNameOf } from '../lib/display-names.mjs';
const DOC_MAX_BYTES = 16 * 1024 * 1024;
/**
 * The newest JSON document of `schema` among a job's files ([{abs, name?}] from collectJobFiles), or null. A file counts only
 * when it parses as JSON carrying that schema, whatever it is called.
 */
export function readAttached(files, schema, accept = () => true) {
  let best = null;
  for (const file of files ?? []) {
    if (!file?.abs) continue;
    let doc = null;
    try {
      if (fs.statSync(file.abs).size > DOC_MAX_BYTES) continue;
      doc = JSON.parse(fs.readFileSync(file.abs, 'utf8'));
    } catch { continue; }
    if (doc?.schema !== schema || !accept(doc)) continue;
    if (!best || String(doc.at ?? '') >= String(best.doc.at ?? '')) best = { doc, file: attachedNameOf(file) };
  }
  return best;
}

/** Every JSON document of `schema` among a job's files, newest first ([{doc, file}]). */
export function readAllAttached(files, schema) {
  const out = [];
  for (const file of files ?? []) {
    const one = readAttached([file], schema);
    if (one) out.push(one);
  }
  return out.sort((a, b) => String(b.doc.at ?? '').localeCompare(String(a.doc.at ?? '')));
}
