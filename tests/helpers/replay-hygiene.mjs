// hygiene.mjs - the scan every replay fixture passes before it is written and in the repository: nothing path-like, token-like, product-named, personal or large.
// A fixture is product-agnostic by construction (neutral.mjs); this is the check that it stayed so.
import fs from 'node:fs';
import path from 'node:path';

export const FIXTURE_MAX_BYTES = 8 * 1024;
/** Names of the products and the people the real ledgers belong to; a fixture mentions none of them. */
const PRODUCT_NAMES = ['nivo', 'starci', 'miamia', 'mia mia', 'tedo', 'tino', 'tayson', 'collab', 'shopify', 'keycloak', 'minio', 'cuong', 'gmail'];
const RULES = [
  { id: 'path-like', re: /[\/]|^[A-Za-z]:|(?:^|\s)~|\.\.\./, why: 'a path separator, a drive letter or a home marker' },
  { id: 'token-like', re: /(?=[A-Za-z0-9+_=-]*\d)[A-Za-z0-9+_=-]{32,}|\beyJ|\bghp_|\bsk-[A-Za-z0-9]|AKIA[A-Z0-9]{8}/, why: 'a run of 32 or more token characters holding a digit, or a known token prefix' },
  { id: 'url-like', re: /:\/\/|@[a-z0-9-]+\.[a-z]{2,}/i, why: 'a URL or an email address' },
];

function* stringsOf(value, trail = '$') {
  if (typeof value === 'string') yield [trail, value];
  else if (Array.isArray(value)) for (const [i, item] of value.entries()) yield* stringsOf(item, `${trail}[${i}]`);
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { yield [`${trail}.${key}.key`, key]; yield* stringsOf(item, `${trail}.${key}`); }
}

/** The findings of one fixture document (and its serialized size): [{where, rule, sample}]. */
export function scanFixture(document) {
  const findings = [];
  for (const [where, text] of stringsOf(document)) {
    for (const rule of RULES) if (rule.re.test(text)) findings.push({ where, rule: rule.id, sample: text.slice(0, 40) });
    const lower = text.toLowerCase();
    for (const name of PRODUCT_NAMES) if (lower.includes(name)) findings.push({ where, rule: 'product-named', sample: name });
  }
  const bytes = Buffer.byteLength(JSON.stringify(document));
  if (bytes > FIXTURE_MAX_BYTES) findings.push({ where: '$', rule: 'too-large', sample: `${bytes} bytes` });
  return findings;
}

/** The fixture files of a directory with their findings: [{file, findings}]. */
export function scanFixtureDir(dir) {
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort()
    .map((name) => ({ file: name, findings: scanFixture(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))) }));
}
