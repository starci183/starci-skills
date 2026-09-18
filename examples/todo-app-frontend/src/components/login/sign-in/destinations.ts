/**
 * The destinations ui.login.sign-in names in its links list. Every one is a proposed route the
 * product does not serve yet - the direction records them as unimplemented furniture, so the screen
 * renders the real anchors and the routes remain a separately owned decision.
 */
export const SIGN_IN_DESTINATIONS = {
  forgotPassword: '/forgot-password',
  createAccount: '/create-account',
  privacyPolicy: '/privacy-policy',
  terms: '/terms',
} as const;

/**
 * The brand turtle master, served from the .starciwork brand record by the route handler at
 * app/sign-in/turtle-master.png/route.ts so the welcome panel reuses the master's actual bytes.
 */
export const SIGN_IN_TURTLE_SRC = '/sign-in/turtle-master.png';
