// escape.mjs — the HTML entity escape for text embedded in markup (Telegram HTML, report blocks).

/** `s` with &, < and > entity-escaped. */
export const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
