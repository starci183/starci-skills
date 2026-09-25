// product-locale.mjs — the language product UI copy is written in, for the packet.
//
// owner_language (config.yaml `language`) is who reads the logs; product_locale
// is who uses the product. They are different people: an owner who reads
// Vietnamese logs can ship an English product, and three parallel drawings that
// took owner_language as their UI language drew one screen in English and two in
// Vietnamese (wf-nivo-modules-agentos). The value is the shell record's
// productLocale.default (.starciwork/shell/index.yaml, work/layout-tree@1), else
// the brand record's voice.locales default; with neither, it is null and the
// packet says so rather than guessing.
import path from 'node:path';
import { productLocaleOf } from '../checks/shell-conformance.mjs';

/** {locale, source} for the Work tree in `repo`, or null. Never throws. */
export function productLocaleFor(repo) {
  try { return repo ? productLocaleOf(path.join(repo, '.starciwork')) : null; } catch { return null; }
}
