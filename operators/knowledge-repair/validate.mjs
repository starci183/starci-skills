import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { sessionRootOf } from '../../scripts/validate-request.mjs';
import { validateAgainst } from '../../scripts/json-schema.mjs';
import { buildKnowledgeManifest } from '../../scripts/knowledge-manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const schema = (root, kind) => json(path.join(root, 'templates', 'kinds', `${kind}.schema.json`));
const safeSessionRef = (session, value) => {
  if (typeof value !== 'string' || path.isAbsolute(value) || path.win32.isAbsolute(value) || value.includes('\\') || value.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  const resolved = path.resolve(session, ...value.split('/'));
  return resolved.startsWith(`${path.resolve(session)}${path.sep}`) ? resolved : null;
};

export function knowledgeRepairEvidenceErrors(question, receipt) {
  const errors = [];
  if (question?.applicabilityValidated !== true) errors.push('knowledge-question: applicability must be validated before teacher knowledge is challenged');
  if (!question?.rule || !question?.impact || !(question?.evidence?.length > 0)) errors.push('knowledge-question: rule, impact and concrete evidence are required (KNOWLEDGE_EVIDENCE_MISSING)');
  if (receipt?.rule !== question?.rule || receipt?.case !== question?.case) errors.push('knowledge-repair receipt repairs a different rule or Case than the question');
  if (receipt?.retry?.operator !== question?.sourceOperator || receipt?.retry?.surfaceRef !== question?.surfaceRef) errors.push('knowledge-repair receipt must retry the originating operator on the same surface/reference');
  if (receipt?.decision === 'append-new-evidenced-rule' && new Set(receipt?.evidence ?? []).size < 2) errors.push('a new rule requires at least two independent evidence refs');
  if (receipt?.manifestBefore === receipt?.manifestAfter) errors.push('knowledge-repair receipt made no manifest progress');
  return errors;
}

export async function validateKnowledgeRepairStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, present = new Set() } = base;
  if (!response || response.operatorId !== 'knowledge.repair' || response.status !== 'done') return { errors };
  const session = sessionRootOf(branchDir);
  let question = null;
  let questionBytes = null;
  const questionFile = safeSessionRef(session, request?.inputs?.['knowledge-question']);
  try { if (!questionFile) throw new Error(); questionBytes = readFileSync(questionFile); question = JSON.parse(questionBytes.toString('utf8')); } catch { errors.push('knowledge-question: input cannot be read from a safe session-relative ref'); }
  if (question) errors.push(...validateAgainst(schema(root, 'knowledge-question'), question, 'knowledge-question'));
  const receiptFile = path.join(branchDir, 'response/data/knowledge-repair.json');
  let receipt = null;
  if (!present.has('knowledge-repair-receipt') || !existsSync(receiptFile)) errors.push('response/data/knowledge-repair.json: missing typed repair receipt');
  else try { receipt = json(receiptFile); } catch { errors.push('response/data/knowledge-repair.json: invalid JSON'); }
  if (receipt) errors.push(...validateAgainst(schema(root, 'knowledge-repair-receipt'), receipt, 'knowledge-repair-receipt'));
  if (!question || !receipt) return { errors };
  if (receipt.questionFingerprint !== hash(questionBytes)) errors.push('knowledge-repair receipt does not bind the exact question bytes');
  errors.push(...knowledgeRepairEvidenceErrors(question, receipt));
  const producerBranch = questionFile ? path.resolve(questionFile, '../../..') : null;
  for (const evidence of question.evidence ?? []) {
    const evidenceFile = producerBranch && safeSessionRef(producerBranch, String(evidence).split('#')[0]);
    if (!evidenceFile || !existsSync(evidenceFile)) errors.push(`knowledge-question evidence is not resolvable in its producer branch: ${evidence}`);
  }
  let before = null;
  try { before = json(path.join(branchDir, 'request/knowledge-manifest.json')); } catch { errors.push('request/knowledge-manifest.json: missing frozen pre-repair manifest'); }
  if (before) {
    if (receipt.manifestBefore !== before.fingerprint) errors.push('knowledge-repair receipt manifestBefore differs from the frozen request');
    let after = null;
    try { after = buildKnowledgeManifest(root, before.bindings, { family: question.family }); } catch (error) { errors.push(error.message); }
    if (after) {
      if (receipt.manifestAfter !== after.fingerprint || receipt.retry.manifestFingerprint !== after.fingerprint) errors.push('knowledge-repair receipt and retry must bind the rebuilt exact manifest');
      const byPath = new Map(after.files.map((file) => [file.path, file]));
      const beforeByPath = new Map((before.files ?? []).map((file) => [file.path, file]));
      for (const file of receipt.files ?? []) {
        const actual = byPath.get(file.path);
        if (!actual || actual.sha256 !== file.after) errors.push(`knowledge-repair receipt after hash is stale: ${file.path}`);
        const prior = beforeByPath.get(file.path);
        if ((prior?.sha256 ?? null) !== file.before) errors.push(`knowledge-repair receipt before hash is stale: ${file.path}`);
        if (file.before === file.after) errors.push(`knowledge-repair receipt file made no progress: ${file.path}`);
        if (!file.path.startsWith('knowledge/ui/') && !file.path.startsWith(`knowledge/grammars/${question.family}/`)) errors.push(`knowledge repair leaves the challenged owner: ${file.path}`);
      }
      const touched = new Set((receipt.files ?? []).map((file) => file.path));
      for (const file of receipt.files ?? []) {
        if (file.path.endsWith('.md') && !file.path.endsWith('.vi.md')) {
          const mirror = file.path.replace(/\.md$/, '.vi.md');
          if (!touched.has(mirror)) errors.push(`knowledge repair must carry the Vietnamese mirror: ${mirror}`);
        }
      }
      if (!after.files.some((file) => file.rules.some((rule) => rule.id === receipt.rule))) errors.push(`rebuilt manifest does not publish repaired rule ${receipt.rule}`);
    }
  }
  if (response.next?.length !== 1 || response.next[0] !== question.sourceOperator) errors.push('response.next must return exactly to the originating operator');
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2];
  if (!branch) { process.stderr.write('usage: node validate.mjs <branch>\n'); process.exitCode = 2; }
  else { const { errors } = await validateKnowledgeRepairStep(path.resolve(branch)); if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid knowledge.repair branch\n'); }
}
