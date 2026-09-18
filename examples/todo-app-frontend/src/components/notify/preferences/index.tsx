'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useSessionToken } from '@/hooks/auth';
import { clearToken } from '@/modules/session';
import { endSession, readNotificationPreferences, unsubscribeFromEmail, updateNotificationPreferences } from '../api';
import { NotifyPreferencesView, type NotifyPreferencesState } from './component';

/** NotifyPreferencesBlock takes no external props; the query, mutations and draft state are its own. */
export type NotifyPreferencesBlockProps = {};

const SAVE_REFUSAL_MESSAGE = "We couldn't save your preference. Try again.";
const LOAD_REFUSAL_MESSAGE = "We couldn't load your preferences. Try again.";
const SESSION_REFUSAL_MESSAGE = 'You need to sign in again before your notification preferences can load.';

/**
 * The connected owner of ui.notify.preferences: it owns the notificationPreferences read, the
 * updateNotificationPreferences and unsubscribe writes, and the unsaved toggle draft, resolves the
 * one state NotifyPreferencesView renders, and hands every render path to the pure view in
 * ./component.tsx. The toggle edits a draft only - `updateNotificationPreferences` persists it, and
 * a refused save drops the draft so the control shows the pre-save value the record demands. It
 * lives under `src/components/notify/` rather than `src/components/blocks/` because this lane's
 * write ceiling is `src/components/notify/**`.
 */
export const NotifyPreferencesBlock = (props: NotifyPreferencesBlockProps) => {
  const token = useSessionToken();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<boolean | null>(null);
  const [saveRefusal, setSaveRefusal] = useState<string | null>(null);
  const [pending, setPending] = useState<'save' | 'unsubscribe' | null>(null);

  // The session store settles on mount; until then the signed-out reading cannot be told from the
  // first client frame, so only the mounted value may decide a session refusal.
  useEffect(() => setHydrated(true), []);

  const preferencesQuery = useSWR(
    token ? (['notification-preferences', token] as const) : null,
    ([, activeToken]) => readNotificationPreferences(activeToken),
  );

  const server = preferencesQuery.data;
  const subscribed = server === undefined ? null : (draft ?? !server.unsubscribed);
  const refusal =
    saveRefusal ??
    (hydrated && token === null
      ? SESSION_REFUSAL_MESSAGE
      : preferencesQuery.error !== undefined && server === undefined
        ? LOAD_REFUSAL_MESSAGE
        : null);

  const state: NotifyPreferencesState =
    pending === 'save'
      ? 'saving'
      : refusal !== null
        ? 'refused'
        : subscribed === null
          ? 'loading'
          : subscribed
            ? 'subscribed'
            : 'unsubscribed';

  const onToggle = () => {
    if (server === undefined || pending !== null) return;
    setDraft(current => !(current ?? !server.unsubscribed));
  };

  const onSave = async () => {
    if (token === null || subscribed === null || pending !== null) return;
    setPending('save');
    setSaveRefusal(null);
    try {
      const saved = await updateNotificationPreferences(token, !subscribed);
      void preferencesQuery.mutate(saved);
      setDraft(null);
    } catch {
      setDraft(null);
      setSaveRefusal(SAVE_REFUSAL_MESSAGE);
    } finally {
      setPending(null);
    }
  };

  const onUnsubscribe = async () => {
    if (token === null || pending !== null) return;
    setPending('unsubscribe');
    setSaveRefusal(null);
    try {
      await unsubscribeFromEmail(token);
      void preferencesQuery.mutate(current => (current === undefined ? current : { ...current, unsubscribed: true }));
      setDraft(null);
    } catch {
      setSaveRefusal(SAVE_REFUSAL_MESSAGE);
    } finally {
      setPending(null);
    }
  };

  const onSignOut = async () => {
    if (token !== null) await endSession(token);
    clearToken();
    router.push('/sign-in');
  };

  return (
    <NotifyPreferencesView
      state={state}
      subscribed={subscribed}
      refusal={refusal}
      pending={pending}
      onToggle={onToggle}
      onSave={onSave}
      onUnsubscribe={onUnsubscribe}
      onSignOut={onSignOut}
    />
  );
};
