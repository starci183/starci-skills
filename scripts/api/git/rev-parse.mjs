// rev-parse.mjs — `git rev-parse --verify --quiet <ref>^{commit}`: the commit a ref names, or null.
import { gitRunner } from './lib.mjs';

export const revParse = (cwd, ref, { git = null } = {}) => {
  const r = gitRunner(git)(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd });
  return r.ok && r.stdout ? r.stdout : null;
};
