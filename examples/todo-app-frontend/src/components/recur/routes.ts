/**
 * The routed navigation owner for ui.recur.schedule: every internal destination the screen links
 * to, named once. Destinations the record marks "direction route; not implemented here" are still
 * real paths - the screen mirrors them honestly without inventing their implementations.
 */
export const ROUTES = {
  tasks: '/tasks',
  notifyPreferences: '/notify/preferences',
  planUsage: '/plan/usage',
  privacy: '/privacy',
  privacyPolicy: '/privacy-policy',
  terms: '/terms',
  signIn: '/sign-in',
} as const;
