// telegram-bridge-text.mjs — what the Telegram bridge says to the owner, in the owner's language (see telegram-bridge.mjs).
import { translator } from '../lib/i18n.mjs';

// The bridge's English sources translate through the i18n catalog (modules/i18n/messages, scripts/lib/i18n.mjs).
export const bridgeText = (language) => {
  const tr = translator(language);
  return {
    chooser: tr('Choose the supervisor to talk to:'),
    none: tr('No supervisor is registered yet.'),
    held: tr('Your message is held and goes to the supervisor you pick.'),
    heldNone: tr('No supervisor is registered yet. Your message is held and goes to the first one you pick (/choose).'),
    talking: (label) => tr('Now talking to {label}.', { label }),
    forwarded: (label) => tr('📥 Forwarded to {label}.', { label }),
    offline: tr('(supervisor offline — it will pick this up when it is back)'),
    gone: tr('That supervisor is no longer registered. /choose another one.'),
    textOnly: tr('Only text messages are forwarded to a supervisor.'),
    statusFailed: tr('The progress report could not be built right now.'),
    asksNone: tr('No question is waiting for you.'),
    asksHead: (n) => tr('{n} open question(s). Press "Generate URL" under the one you want to answer:', { n }),
    credsHint: (n) => tr('{n} credential ask(s) wait for values: /creds', { n }),
    credsNone: tr('No credential ask is waiting.'),
    credsHead: (n) => tr('🔑 {n} credential ask(s) wait for values. They never hold the main line; only live proof (UAT) waits on them. Press one to open its form:', { n }),
    askClosed: tr('This question no longer needs an answer.'),
    askGenerating: tr('Opening the answer form…'),
    unknown: tr('Unknown command.'),
    help: [
      tr('Commands:'),
      tr('/choose — pick the supervisor to talk to'),
      tr('/status — the progress report'),
      tr('/asks — the decisions waiting on you, each with a Generate URL button'),
      tr('/creds — the credential asks (keys, secrets) in one list; they never hold the main line'),
      tr('/help — this list'),
      tr('Any other text goes to the supervisor you picked.'),
    ].join('\n'),
  };
};
