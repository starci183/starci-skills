import { loadConfig } from './config.mjs';
import { generate } from '../ops/generate.mjs';
import { build } from './build-workflows.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const knowledgeCompilerPath = path.join(skillRoot, 'scripts', 'compile-knowledge.mjs');

async function loadKnowledgeCompiler() {
  if (!fs.existsSync(knowledgeCompilerPath)) throw Error('Knowledge compiler is required');
  const mod = await import(pathToFileURL(knowledgeCompilerPath).href);
  if (typeof mod.compileKnowledge !== 'function') {
    throw Error('scripts/compile-knowledge.mjs must export compileKnowledge');
  }
  return mod.compileKnowledge;
}

export async function ensureBuild() {
  loadConfig(undefined, { initialize: true });
  // Fail closed: compiler must exist; full build integrates knowledge (no deferred success).
  await loadKnowledgeCompiler();

  let stale = false;
  if (!stale) {
    try { stale = !build({ check: true }).ok; }
    catch { stale = true; }
  }
  if (!stale) return { ok: true, rebuilt: false };

  const result = build();
  if (!result.ok || !build({ check: true }).ok) {
    throw Error('Build verification failed; do not consume stale contracts.');
  }
  return { ...result, rebuilt: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await ensureBuild();
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
