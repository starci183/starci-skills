import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildKnowledgeManifest, manifestEntities } from './knowledge-manifest.mjs';

export function fixtureFamilyUnderstanding() {
  return {
    schemaVersion: 10, grammarId: 'starci', packageBinding: { name: '@starci/grammar', version: '0.4.12', sourceRef: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    authoritySplit: { common: 'owns shared anatomy and semantics', family: 'owns scoped visual values', product: 'owns facts routes copy and effects' },
    visualPrinciples: [{ principle: 'neutral surfaces with one earned accent', source: 'knowledge/grammars/starci/family.md' }],
    businessShape: { shape: 'fixture', fit: 'composed', source: 'knowledge/grammars/starci/playbook.md' },
    reuse: [{ concept: 'existing composition', owner: 'common', source: 'knowledge/ui/INDEX.md' }], ownerSearch: { common: ['knowledge/ui/INDEX.md'], family: [], product: [], gaps: [] }, decision: 'compose',
    deltas: { props: [], anatomy: [], tokens: [], claims: [], classes: [] }, consumers: ['fixture-surface'], compatibility: 'existing public behavior remains compatible',
    proof: { before: 'fixture-before.png', after: 'fixture-after.png' }, knowledgeChallenges: [], rollback: 'remove the fixture composition change',
  };
}

export function writeUiKnowledgeFixture(root, branch, bindings, operationRef) {
  const manifest = buildKnowledgeManifest(root, bindings, { family: 'starci' });
  const coverage = { schemaVersion: 10, manifestFingerprint: manifest.fingerprint, items: manifestEntities(manifest).map(({ key, source, kind }) => ({
    key, applicability: 'applicable', actual: `fixture evaluates ${key}`, evidence: [kind === 'file' ? source : operationRef],
  })) };
  const brief = fixtureFamilyUnderstanding();
  writeFileSync(path.join(branch, 'request/knowledge-manifest.json'), JSON.stringify(manifest));
  writeFileSync(path.join(branch, 'request/family-understanding.json'), JSON.stringify(brief));
  writeFileSync(path.join(branch, 'response/data/knowledge-coverage.json'), JSON.stringify(coverage));
  writeFileSync(path.join(branch, 'response/data/family-understanding.json'), JSON.stringify(brief));
}
