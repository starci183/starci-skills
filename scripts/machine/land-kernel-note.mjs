// land-kernel-note.mjs - the one-line note a land may carry for the Kernels ("what a Kernel must do differently"). The land record is the
// git note of the landed tip (refs/notes/land, scripts/supervisor/git-land-repo.mjs); the note is one trailer line of it, and the runtime
// reads it back from there when it wakes a Kernel (scripts/kernel/runtime-rev.mjs landKernelNotes).
export const KERNEL_NOTE_TRAILER = 'Kernel-Note';
/** The longest note a land carries: a line a wake can hold. */
const KERNEL_NOTE_MAX = 400;

/** Why `--kernel-note` value `raw` is refused, or null when it is absent or one non-empty line. Pure. */
export function kernelNoteRefusal(raw) {
  if (raw === undefined) return null;
  const text = typeof raw === 'string' ? raw : '';
  if (!text.trim()) return '--kernel-note needs one non-empty line';
  if (/[\r\n]/.test(text)) return '--kernel-note is one line: no line break';
  if (text.trim().length > KERNEL_NOTE_MAX) return `--kernel-note is at most ${KERNEL_NOTE_MAX} characters`;
  return null;
}

/** The notes of the land records `text` (the %N of git log --notes=land, records separated by NUL) carries, oldest first as given. Pure. */
export function kernelNotesOf(records) {
  const prefix = `${KERNEL_NOTE_TRAILER}: `;
  return records.flatMap((record) => String(record ?? '').split(/\r?\n/).filter((line) => line.startsWith(prefix)).map((line) => line.slice(prefix.length).trim()).filter(Boolean));
}
