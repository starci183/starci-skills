import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SignInScreenBlock } from './index';

/**
 * The world the block reaches for, resolved here to a fixture: useSignIn's submit always resolves
 * with the uniform refusal, which is the outcome ui.login.sign-in's refused state is drawn around.
 */
const world = vi.hoisted(() => ({
  submitting: false,
  refusal: null as string | null,
  submit: vi.fn(async (_email: string, _password: string) => {}),
}));

vi.mock('@/hooks/auth', () => ({
  useSignIn: () => world,
}));

describe('SignInScreenBlock', () => {
  it('ui.login.sign-in: a settled refusal keeps the email and clears the password', async () => {
    world.submit.mockImplementation(async () => {
      world.refusal = 'That email and password do not match.';
    });
    render(<SignInScreenBlock />);
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    fireEvent.change(email, { target: { value: 'a@b.com' } });
    fireEvent.change(password, { target: { value: 'secret' } });
    screen.getByRole('button', { name: 'Sign in' }).click();
    await waitFor(() => {
      expect(world.submit).toHaveBeenCalledWith('a@b.com', 'secret');
    });
    await waitFor(() => {
      expect((password as HTMLInputElement).value).toBe('');
    });
    expect((email as HTMLInputElement).value).toBe('a@b.com');
  });
});
