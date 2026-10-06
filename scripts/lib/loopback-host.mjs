// loopback-host.mjs — which host names mean this machine (the URL policies of scripts/api/http/request.mjs and scripts/api/windsurf/lib.mjs).

/** Whether `hostname` (a URL's .hostname, brackets allowed) is localhost, 127.0.0.0/8 or ::1. */
export const isLoopbackHost = (hostname) => /^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(String(hostname ?? ''));
