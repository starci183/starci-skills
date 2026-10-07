// shell-findings.mjs — the finding shape and the shown path every shell-conformance check reports with.
import path from 'node:path';
import { slash } from '../work-io.mjs';

export const finding = (level, code, file, message) => ({ level, code, file, message });

/** A finding that refuses the record. */
export const refuse = (code, file, message) => finding('refuse', code, file, message);

/** A file as the repository-relative path a finding names. */
export const shown = (workRoot, file) => slash(path.relative(path.dirname(workRoot), file)) || slash(file);
