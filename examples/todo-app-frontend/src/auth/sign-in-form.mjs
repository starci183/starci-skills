/**
 * The sign-in screen of ui.login.sign-in: empty, filled, refused, working. The refusal text is deliberately
 * one message for both halves of the pair, because br.login.password.sign-in says a refusal must not say
 * which half was wrong - a screen that helpfully distinguishes them would break the rule from the outside.
 */
export const REFUSAL = 'That email and password do not match.';

export function renderSignIn({email = '', password = '', submitting = false, refused = false} = {}) {
  if (submitting) return {state: 'working', disabled: true};
  if (refused) return {state: 'refused', message: REFUSAL, disabled: false};
  return {state: email || password ? 'filled' : 'empty', disabled: !(email && password)};
}

