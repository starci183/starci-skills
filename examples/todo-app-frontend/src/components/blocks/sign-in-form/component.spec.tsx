import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignInFormView } from './component';

const noop = () => {};

describe('SignInFormView', () => {
  it('ui.login.sign-in: empty state has no values and a disabled submit', () => {
    render(
      <SignInFormView
        state="empty"
        email=""
        password=""
        refusal={null}
        onEmailChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('ui.login.sign-in: filled state enables submit once both fields hold a value', () => {
    render(
      <SignInFormView
        state="filled"
        email="a@b.com"
        password="x"
        refusal={null}
        onEmailChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('ui.login.sign-in: working state disables the form while submitting', () => {
    render(
      <SignInFormView
        state="working"
        email="a@b.com"
        password="x"
        refusal={null}
        onEmailChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  });

  it('ac.login.password.sign-in.refusal-does-not-name-the-half: refused state carries one message regardless of which half was wrong', () => {
    const message = 'That email and password do not match.';
    render(
      <SignInFormView
        state="refused"
        email="a@b.com"
        password="x"
        refusal={message}
        onEmailChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('ac.login.password.sign-in.wrong-pair-is-refused: submitting calls onSubmit exactly once', async () => {
    const onSubmit = vi.fn();
    render(
      <SignInFormView
        state="filled"
        email="a@b.com"
        password="x"
        refusal={null}
        onEmailChange={noop}
        onPasswordChange={noop}
        onSubmit={onSubmit}
      />,
    );
    screen.getByRole('button', { name: 'Sign in' }).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
