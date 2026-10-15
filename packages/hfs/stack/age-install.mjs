// age-install.mjs - installs `age` (the backup encryptor) on the manager over passwordless sudo: the host's own package manager first
// (dnf, yum, apk or apt-get, detected, never assumed), then the official static binary with its sha256 verified before anything is installed.
import { firstLine } from './context.mjs';

const AGE_VERSION = 'v1.2.1';
const AGE_URL = `https://github.com/FiloSottile/age/releases/download/${AGE_VERSION}/age-${AGE_VERSION}-linux-amd64.tar.gz`;
/** sha256 of the official linux/amd64 archive of AGE_VERSION. */
export const AGE_SHA256 = '7df45a6cc87d4da11cc03a539a7470c15b1041ab2b396af088fe9990f7c79d50';
const INSTALL = { dnf: 'sudo -n dnf install -y age', yum: 'sudo -n yum install -y age', apk: 'sudo -n apk add age', 'apt-get': 'sudo -n apt-get install -y age' };

const STATIC_INSTALL = [
  'set -e',
  'tmp="$(mktemp -d)"',
  'trap \'rm -rf "$tmp"\' EXIT',
  `curl -fsSL -o "$tmp/age.tgz" ${AGE_URL}`,
  `echo "${AGE_SHA256}  $tmp/age.tgz" | sha256sum -c -`,
  'tar -xzf "$tmp/age.tgz" -C "$tmp"',
  'sudo -n install -m 0755 "$tmp/age/age" "$tmp/age/age-keygen" /usr/local/bin/',
].join('; ');

const packageManager = (run) => run('for m in dnf yum apk apt-get; do command -v $m >/dev/null 2>&1 && echo $m && break; done').stdout.trim();
const present = (run) => run('command -v age').status === 0;

/** Installs age when it is missing; reports through `report`. */
export function installAge(run, report) {
  if (present(run)) return;
  const manager = packageManager(run);
  let failure = 'no package manager (dnf, yum, apk, apt-get) found';
  if (Object.hasOwn(INSTALL, manager)) {
    const packaged = run(INSTALL[manager]);
    if (packaged.status === 0 && present(run)) { report.note(`installed age with ${manager}`); return; }
    failure = `${manager} could not install age: ${firstLine(packaged.stderr)}`;
  }
  const fetched = run(STATIC_INSTALL);
  if (fetched.status === 0 && present(run)) report.note(`installed the official static age ${AGE_VERSION} (sha256 verified) into /usr/local/bin; ${failure}`);
  else report.bad(`cannot install age (${failure}); the static install failed too: ${firstLine(fetched.stderr)} (needs passwordless sudo once, or install age by hand)`);
}
