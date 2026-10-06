// write-families.mjs — an authoring op is enqueued only onto the Work families its manifest may write.
//
// Measured since 2026-09-27T05:50Z (the *mujek* restart workflows), most business.decide and
// architecture.decide failures were one refusal the worker could only discover after launch: the Kernel
// dispatched the op onto a node of another family - business.decide onto integration/ (sn-learn-content
// a1, a2), impl/ + src/ (sn-subscription a1, a2) and records under the architecture/ grouping folder (modules-agentos a1);
// architecture.decide onto journey/ (collab a1). Each worker read the brief, found its `writes` could
// not touch any granted path, and reported blocked kind authority - an LLM attempt spent to learn what
// the manifest already says.
//
// familyGuardOf(brief) -> {families:Set, overview:boolean} | null
//   For an op whose every `writes[].path` is either a .starciwork/features/<feature>/{...} family
//   pattern or an evidence/graph path (evidence/..., under .starciwork), the literal families it may author.
//   An op that also writes source (repository:...), node-relative (N/...) or unfamilied paths is not
//   guarded (null): its grants are not family-shaped.
// familyViolations(guard, ownedPaths) -> [{path, family|null, why}]
//   An owned path under .starciwork/features/<f>/<family>/ outside the guard's families, the feature
//   overview when the op may not write it, or a path outside .starciwork altogether (source).
// familyOwners(briefs) -> Map family -> [op]: who may author a family, for the refusal's hint.
const FEATURE_WRITE = /^\.starciwork\/features\/<feature>\/(.+)$/;
// Evidence and the job scratch (read-digest.json, gate.json: the attached proofs) are not Work records: they never widen or
// disable the family guard.
const EVIDENCE_WRITE = /^(?:evidence\/|\$?STARCI_JOB_SCRATCH\/)/;

const expandBraces = (text) => {
  const m = /\{([^{}]*)\}/.exec(text);
  if (!m) return [text];
  return m[1].split(',').flatMap((alt) => expandBraces(text.slice(0, m.index) + alt + text.slice(m.index + m[0].length)));
};

const familyOfPattern = (rest) => {
  if (rest === 'index.yaml') return { overview: true };
  const first = rest.split('/')[0];
  return first && !first.startsWith('<') ? { family: first } : { unfamilied: true };
};

export function familyGuardOf(brief) {
  const writes = Array.isArray(brief?.writes) ? brief.writes.map((w) => (typeof w?.path === 'string' ? w.path.trim() : '')) : [];
  if (!writes.length) return null;
  const families = new Set();
  let overview = false, featureWrites = 0;
  for (const write of writes) {
    if (EVIDENCE_WRITE.test(write)) continue;
    const m = FEATURE_WRITE.exec(write);
    if (!m) return null;
    for (const alt of expandBraces(m[1])) {
      const kind = familyOfPattern(alt);
      if (kind.unfamilied) return null;
      if (kind.overview) overview = true;
      else families.add(kind.family);
      featureWrites += 1;
    }
  }
  return featureWrites ? { families, overview } : null;
}

const slash = (p) => String(p).replaceAll('\\', '/').replace(/^\.\//, '');

export function familyViolations(guard, ownedPaths) {
  if (!guard) return [];
  const out = [];
  for (const raw of ownedPaths) {
    const p = slash(typeof raw === 'string' ? raw : raw?.path ?? '').replace(/\/\*\*$/, '').replace(/\/+$/, '');
    if (!p) continue;
    const at = p.indexOf('.starciwork/');
    if (at < 0) { out.push({ path: p, family: null, why: 'outside .starciwork: this op authors Work records, never source' }); continue; }
    const work = p.slice(at);
    const m = /^\.starciwork\/features\/[^/]+(?:\/(.*))?$/.exec(work);
    if (!m) continue; // evidence, work graph, other Work areas: the op's report and graph writes
    const rest = m[1] ?? '';
    if (!rest || rest === 'index.yaml') {
      if (!guard.overview && rest === 'index.yaml') out.push({ path: p, family: 'overview', why: 'the feature overview is not this op\'s to write' });
      continue;
    }
    const family = rest.split('/')[0];
    if (!guard.families.has(family)) out.push({ path: p, family, why: `family ${family}/ is not in this op's writes (${[...guard.families].join(', ')})` });
  }
  return out;
}

export function familyOwners(briefs) {
  const owners = new Map();
  for (const brief of briefs) {
    for (const write of Array.isArray(brief?.writes) ? brief.writes : []) {
      const m = FEATURE_WRITE.exec(String(write?.path ?? '').trim());
      if (!m) continue;
      for (const alt of expandBraces(m[1])) {
        const kind = familyOfPattern(alt);
        if (!kind.family) continue;
        if (!owners.has(kind.family)) owners.set(kind.family, []);
        if (!owners.get(kind.family).includes(brief.id)) owners.get(kind.family).push(brief.id);
      }
    }
  }
  return owners;
}
