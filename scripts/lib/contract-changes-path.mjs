// contract-changes-path.mjs — where a contract-change entry file lives (pure path rules; the registry reader is
// scripts/kernel/contract-changes-store.mjs). One file per entry: modules/kernel/contract-changes/<id>.yaml.
/** One file per entry: <dir>/<id>.yaml. */
export const CONTRACT_CHANGES_DIR = 'modules/kernel/contract-changes';

const norm = (p) => String(p ?? '').replaceAll('\', '/').replace(/^\.\//, '');
/** A registry path: an entry file under the directory. */
export const isContractChangesPath = (rel) => { const f = norm(rel); return f.startsWith(`${CONTRACT_CHANGES_DIR}/`) && /\.ya?ml$/.test(f); };
/** The entry file of change `id` (runtime-relative). */
export const entryFileOf = (id) => `${CONTRACT_CHANGES_DIR}/${id}.yaml`;
