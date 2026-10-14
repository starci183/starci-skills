// secret-custody-only.mjs - R277: the only custody a tracked secret may take is a sops envelope at
// `.starcistacks/<env>/secrets/**.enc`. Everything else is refused in every edition:
//   - a tracked plaintext secret file by being (`secrets.env`, a non-dot `*.env` with secret keys, a member of
//     a `secrets/` directory, deploy-side dotenv) - HFS_SECRET_PLAINTEXT_FILE;
//   - an `.enc` outside the sealed home - HFS_SECRET_OUTSIDE_ENC (lite already reports it as
//     HFS_LITE_SECRET_CUSTODY, so the lite check keeps that one code).
// Dotfile `.env*`, `.secrets/` and `.starcistacks/<env>/secrets/` plaintext are already refused by R06's
// FORBIDDEN_FILES; this rule refuses the names R06's path list does not name. A finding never carries a value.
import { secretHits, secretNameLike } from '../../lib/secret-patterns.mjs';
import { found, readText } from './read.mjs';

const PLAINTEXT_FILE = 'HFS_SECRET_PLAINTEXT_FILE';
const OUTSIDE_ENC = 'HFS_SECRET_OUTSIDE_ENC';

// `secrets.env` at any depth, plus `.secret.env`/`.secrets.env` - a dotenv file named for what it holds.
const SECRET_ENV = /(?:^|\/)\.?secrets?\.env$/i;
// A non-dot `<name>.env` or `<name>.env.<profile>` tracked file (deploy/prod.env, config.env.local); the
// documented example/template suffixes are shareable forms, not custody.
const ENV_FILE = /(?:^|\/)[^/.][^/]*\.env(?:\.(?!example|sample|template)[^/]*)?$/i;
// A plaintext secret store: `secrets/<name>.yaml` and friends - except under `.starcistacks/<env>/secrets/`,
// which R06 already judges, and the sealed `.enc` members, which are custody.
const SECRETS_DIR = /(?:^|\/)secrets\/[^/]+\.(?:ya?ml|env|json|conf|cfg|ini|toml|txt|properties)$/i;
const SEALED_DIR = /^\.starcistacks\/[^/]+\/secrets\//;
const SEALED_HOME = /^\.starcistacks\/[^/]+\/secrets\/[^/]+\.enc$/;

const KEY_LINE = /^\s*(?:export\s+)?([A-Za-z_$][\w$]*)\s*=/;
const hasSecretKeys = (file, text) =>
  text.split(/\r?\n/).some((line) => {
    const key = KEY_LINE.exec(line);
    return (key && secretNameLike(key[1])) || secretHits(file, line).length > 0;
  });

const sealedCustodyFindings = (file, posix, repo) => {
  if (SEALED_HOME.test(posix) || repo.edition === 'lite') return [];
  return [found(OUTSIDE_ENC, file,
    `${file} is a sealed secret outside .starcistacks/<env>/secrets/; only that directory may hold committed secret envelopes`)];
};

export function secretCustodyOnlyFindings({ repoRoot, files, repo, inScope }) {
  const findings = [];
  for (const file of files.filter((f) => !inScope || inScope(f))) {
    const posix = file.replaceAll('\\', '/');
    if (file.endsWith('.enc')) {
      findings.push(...sealedCustodyFindings(file, posix, repo));
      continue;
    }
    if (SEALED_DIR.test(posix)) continue;
    if (SECRET_ENV.test(posix)) {
      findings.push(found(PLAINTEXT_FILE, file,
        `${file} is a tracked plaintext secrets dotenv; seal secrets with starci app secret set into .starcistacks/<env>/secrets/<slug>.enc - never commit the plaintext`));
      continue;
    }
    if (SECRETS_DIR.test(posix)) {
      findings.push(found(PLAINTEXT_FILE, file,
        `${file} is a tracked plaintext file inside a secrets/ directory; seal secrets with sops into .starcistacks/<env>/secrets/<slug>.enc - never commit the plaintext`));
      continue;
    }
    if (!ENV_FILE.test(posix)) continue;
    const text = readText(repoRoot, file);
    if (text === null || !hasSecretKeys(file, text)) continue;
    findings.push(found(PLAINTEXT_FILE, file,
      `${file} is a tracked dotenv file holding secret keys; seal secrets with sops into .starcistacks/<env>/secrets/<slug>.enc - never commit the plaintext`));
  }
  return findings;
}
