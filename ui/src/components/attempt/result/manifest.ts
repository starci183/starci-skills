import type { AttemptDetailV3, AttemptManifest, EvidenceFile } from '../../../contract';

/** Whether an evidence file is the attempt's manifest.yaml/yml, which the result card parses instead of listing as a plain file. */
export const isManifestFile = (file: EvidenceFile) => /(^|\/)manifest\.ya?ml$/i.test(file.name);

/** The manifest the server read from the attempt's evidence folder. */
export const manifestOf = (attempt: AttemptDetailV3): AttemptManifest | null => attempt.manifest;
