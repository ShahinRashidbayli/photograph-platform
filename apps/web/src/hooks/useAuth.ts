import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TranslationKey } from '@/lib/i18n';
import { useAuthStore, type AuthUser } from '@/store/authStore';

/**
 * Sessions, sign-up and the signed-in account.
 *
 * <p>The signed-in user lives in `authStore`, not in the query cache — nearly
 * every screen reads it from there, synchronously. So for these hooks the
 * store is the cache: a mutation that returns the user writes it there.
 *
 * <p>Whenever the session changes hands — sign in, sign up, sign out — every
 * cached query is dropped. The app moves between them with client-side
 * navigation, so the cache outlives the session: without this, a studio that
 * signed in on the same tab as another saw that studio's bookings, leads and
 * invoices until each list refetched.
 */

export function sessionUserKey() {
  return ['auth', 'me'] as const;
}

/** Drops every query (not the mutations, whose callbacks may still be running). */
function useForgetSession() {
  const qc = useQueryClient();
  return () => qc.removeQueries();
}

/**
 * Who is signed in, read from the cookies' session. Mirrored into `authStore`.
 * Not retried: a 401 means signed out, and asking again only delays the redirect.
 */
export function useSessionUser(enabled = true) {
  const setUser = useAuthStore((s) => s.setUser);
  const query = useQuery({
    queryKey: sessionUserKey(),
    enabled,
    retry: false,
    queryFn: async () => (await api.get<AuthUser>('/api/auth/me')).data,
  });
  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);
  return query;
}

function useSignedIn() {
  const forget = useForgetSession();
  const setUser = useAuthStore((s) => s.setUser);
  return (user: AuthUser) => {
    forget();
    setUser(user);
  };
}

export function useLogin() {
  const signedIn = useSignedIn();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      (await api.post<AuthUser>('/api/auth/login', input)).data,
    onSuccess: signedIn,
  });
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  subdomain: string;
  role: 'PHOTOGRAPHER';
  /** Null applies the backend's STARTER default. */
  plan: string | null;
}

export function useRegister() {
  const signedIn = useSignedIn();
  return useMutation({
    mutationFn: async (input: RegisterInput) =>
      (await api.post<AuthUser>('/api/auth/register', input)).data,
    onSuccess: signedIn,
  });
}

/**
 * Best-effort: resolves even when the request fails, because local state has
 * to be cleared either way. Clearing the user is left to the caller, after it
 * has navigated away — otherwise the layout's session read refires against
 * cookies that are already gone.
 */
export function useLogout() {
  const forget = useForgetSession();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.post('/api/auth/logout');
      } catch {
        /* signed out locally regardless */
      }
    },
    onSettled: forget,
  });
}

export interface SubdomainAvailability {
  subdomain: string;
  available: boolean;
  reason: 'RESERVED' | 'TAKEN' | 'INVALID' | null;
}

/**
 * Advisory only — register still enforces uniqueness — so it is keyed by the
 * name asked about, and a slow answer for a name already typed past can never
 * be shown for the current one. Null asks nothing.
 */
export function useSubdomainAvailability(subdomain: string | null) {
  return useQuery({
    queryKey: ['auth', 'subdomain-available', subdomain] as const,
    enabled: subdomain !== null,
    retry: false,
    queryFn: async () =>
      (
        await api.get<SubdomainAvailability>('/api/auth/subdomain-available', {
          params: { subdomain },
        })
      ).data,
  });
}

/** Answers 204 whether or not the address exists — see the forgot-password screen. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post('/api/auth/password/forgot', { email }),
  });
}

export function useResetPassword() {
  return useMutation({
    // A missing token is sent as-is; the API answers 401, which the screen
    // shows as "this link is no longer usable".
    mutationFn: (input: { token: string | null; password: string }) =>
      api.post('/api/auth/password/reset', input),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => api.post('/api/auth/verify-email', { token }),
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => api.post('/api/auth/resend-verification') });
}

/** Mirrors `InvitationPreviewResponse` on the API. */
export interface InvitationPreview {
  studioName: string;
  email: string;
}

/**
 * Expired, spent and unknown tokens answer identically by design, so any
 * failure is "this link is no longer usable" — and not worth retrying.
 */
export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: ['invitations', token] as const,
    enabled: token !== '',
    retry: false,
    queryFn: async () =>
      (await api.get<InvitationPreview>('/api/public/invitations', { params: { token } })).data,
  });
}

/** Creates the account but no session: signing in goes through the ordinary login. */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (input: { token: string; fullName: string; password: string }) =>
      api.post('/api/public/invitations/accept', input),
  });
}

/** A client's sign-in code, mailed. Used for the first request and every resend. */
export function useRequestLoginCode() {
  return useMutation({
    // Without a subdomain the server finds the studios that know the address
    // and emails a code for each (sign-in by email).
    mutationFn: (input: { email: string; subdomain: string | null; fullName: string | null }) =>
      api.post('/api/auth/customer/login-code/request', input),
  });
}

/**
 * The session lands as cookies on this response; the caller follows it with a
 * full navigation, which also starts the next session's cache from nothing.
 */
export function useVerifyLoginCode() {
  return useMutation({
    mutationFn: (input: { email: string; subdomain: string | null; code: string }) =>
      api.post<{ tenant?: { subdomain?: string } }>('/api/auth/customer/login-code/verify', input),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: { fullName?: string; subdomain?: string; avatarUrl?: string }) =>
      (await api.patch<AuthUser>('/api/auth/me', input)).data,
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(sessionUserKey(), user);
    },
  });
}

/**
 * An avatar upload failure with a translatable cause. The steps below throw
 * one rather than a sentence: the screen used to throw translated messages and
 * then read only the API's own, so "storage is unavailable" and "the upload
 * failed" never reached anyone — every failure said the same generic thing.
 */
export class AvatarUploadError extends Error {
  constructor(readonly key: TranslationKey) {
    super(key);
    this.name = 'AvatarUploadError';
  }
}

/**
 * Presign, PUT straight to storage, then store the object key on the profile.
 * The key, never the view URL: that is a pre-signed GET that expires with
 * app.r2.presigned-expiry-minutes, so saving it turned every avatar into a 403
 * an hour after upload. The backend re-signs the key on every read instead.
 */
export function useUploadAvatar() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (file: File) => {
      const contentType = file.type || 'image/jpeg';
      const { data: presign } = await api.post<{
        uploadUrl: string;
        viewUrl: string;
        r2Key: string;
        // The type the URL was signed with, which may differ from what we asked
        // for (the API canonicalises image/jpg to image/jpeg). Content-Type is
        // a signed header on the presigned PUT, so the upload must send this.
        contentType: string;
      }>(
        `/api/auth/me/avatar/presign?contentType=${encodeURIComponent(contentType)}` +
          // Signed into the URL as Content-Length, which is what stops a
          // presigned PUT from being an unbounded write.
          `&fileSizeBytes=${file.size}`
      );
      if (!presign.uploadUrl || !presign.r2Key) {
        throw new AvatarUploadError('settings.account.storageUnavailable');
      }
      const uploaded = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presign.contentType },
        body: file,
      });
      if (!uploaded.ok) throw new AvatarUploadError('settings.account.uploadFailed');
      return (await api.patch<AuthUser>('/api/auth/me', { avatarUrl: presign.r2Key })).data;
    },
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(sessionUserKey(), user);
    },
  });
}
