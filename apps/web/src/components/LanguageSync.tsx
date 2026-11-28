'use client';

import { useEffect } from 'react';
import { useUpdateProfile } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';

/**
 * Keeps the signed-in user's stored language in step with the one on screen.
 *
 * <p>The language choice lives on the device (`langStore`); the emails Fotolio
 * sends — Notifications, password reset — are written on the server, which
 * only knows what it was last told. So whenever the two differ, on a switch or
 * on signing in from a device set the other way, the device's is saved: the
 * language someone is using the app in is the one they read.
 *
 * <p>Fires once per difference: a failed save leaves both values as they were,
 * so it does not retry in a loop, and the next switch or sign-in tries again.
 */
export function LanguageSync() {
  const lang = useLangStore((s) => s.lang);
  const stored = useAuthStore((s) => s.user?.language);
  const { mutate } = useUpdateProfile();

  useEffect(() => {
    if (stored && stored !== lang) mutate({ language: lang });
  }, [stored, lang, mutate]);

  return null;
}
