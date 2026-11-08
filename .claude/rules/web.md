---
paths:
  - "apps/web/**"
---

# apps/web — Next.js

`src/` layout:

| Path | What |
|---|---|
| `app/(dashboard)/<surface>/` | photographer screens (`page.tsx`, optional `<surface>.styles.ts`) |
| `app/(auth)/` | login, register, reset, invite |
| `app/customer/` | client (CUSTOMER) portal |
| `app/p/[subdomain]`, `g/`, `r/` | public studio pages: portfolio, gallery, request form |
| `hooks/use<Surface>.ts` | TanStack Query hooks + exported query-key factories |
| `lib/api.ts` | the only axios instance (cookies, CSRF, 401 refresh, 402/403 handling) — always import `api` from here |
| `types/api.ts` | response/request types mirroring BE DTOs |
| `components/ui/` | shared primitives (`Button`, `Card`, `Field`, `Modal`, `Alert`, `Badge`, `Toggle`, `EmptyState`) + `useColors` tokens |
| `components/layout/` | dashboard shell pieces |
| `lib/nav.ts` | sidebar model (data only) — add new dashboard pages here |
| `app/(dashboard)/settings/settings-nav.ts` | settings sub-navigation |
| `store/` | Zustand: `authStore`, `langStore`, `themeStore` |
| `lib/i18n/` | `useTranslation`, formatters; dictionaries in `locales/{en,de}/<surface>.ts` |

## Rules

- **Data fetching**: every client-side API call lives in a hook in `hooks/` — see
  "Data layer" below. No `api.*` and no `useEffect` fetches in pages or components.
- **UI**: use `components/ui` primitives for new/edited UI. Most old screens still
  hand-roll inline styles — migrate the part you touch, don't add new hand-rolled buttons/modals.
  No new styling library. Theme via `useColors()` / `useThemeStore`.
- **Visual system** (ink-on-paper, `lib/design-tokens.ts`): the UI is colourless on
  purpose — ink primary, warm graphite neutrals, colour only for status. Text on a
  `primary`/`primarySolid` fill is `c.onPrimary`, never `#fff` (dark mode inverts the
  fill). Page `<h1>` spreads `pageTitle` (Geist 600, tight tracking) — never a
  hand-rolled title. The Instrument Serif face is for the public portfolio
  (`app/p/`) only, never in the app or auth screens. One exception: the auth brand panel
  (left side of `AuthSplitLayout`) uses the landing faces and its `*accent*` word, as the
  step between landing and app — the form column stays Geist. No uppercase/tracked eyebrow labels, no gradients, no glow
  shadows, weights ≤ 600. Hover/press come from `globals.css` classes (`ui-press`,
  `ui-btn-*`, `ui-row-hover` + `--ui-row-hover`), not `onMouseEnter`. A row that
  highlights on hover must be a link. Static style objects use `var(--ui-ink)` /
  `var(--ui-paper)`.
- **Landing page** (`app/LandingPage.tsx` + `app/_landing/*`) is the one exception: its own
  palette (warm paper, ink, charcoal — no accent hue; colour comes from the photos) as
  `--lp-*` vars and `.lp-*` classes in `globals.css`; previews take `--pv-*`, which follow
  the theme (the hero stays dark in both),
  its own faces (`_landing/fonts.ts`, route-scoped). Plan rows come from `PLAN_TIERS`;
  claims are pinned in `landing.claims.test.tsx` — never picture a feature the product
  lacks (no favourites, sharing or comments in galleries). Stand-in photos + credits:
  `_landing/stock.ts`.
- **i18n**: no hardcoded user-visible strings. Add keys to both `locales/en/<surface>.ts`
  and `locales/de/<surface>.ts` (new surface → register in both `index.ts`). Keys are flat,
  dot-namespaced (`clients.filter.All`). `npm run i18n:check` catches placeholder/plural/orphan issues.
- **Plan gating**: whether this tenant *has* a capability → `useEntitlements` (server is
  authoritative). `lib/plan-gate.ts` only names which tier unlocks it. 402 → `PlanUpgradeDialog`.
- **Mobile**: `useMediaQuery` + `MobilePaneBack` for list/detail screens (see `clients/page.tsx`).
- **Redirects**: use `lib/safe-redirect.ts` / `lib/login-redirect.ts`, never raw `next` params.

## Data layer (the standard every screen follows)

Template: `hooks/useGalleries.ts` + `app/(dashboard)/galleries/page.tsx`.

**Hook file** `hooks/use<Surface>.ts`:
- Types mirroring the API DTOs at the top, each with a "Mirrors XResponse on the API" doc comment.
- Key factories exported as functions: `galleriesKey()`, `galleryPhotosKey(id)`.
  One prefix per resource (`['packages', { activeOnly }]`) so invalidating the
  prefix refreshes every view of it.
- One `useX()` per query. `queryFn` normalises: `Array.isArray(res.data) ? res.data : []`.
- One hook per write, verb first: `useCreateGallery`, `useDeletePackage`, `useSaveBooking`.
  **The mutation owns the cache update** — `setQueryData`
  when the response is the new row, `invalidateQueries` (returned from `onSuccess`, so
  the mutation resolves after the refetch) when the server decides order or derived
  fields. Screens never touch `queryClient` themselves.
- Optimistic only where the round-trip is the UX problem (`useUpdateBookingStatus`):
  `cancelQueries` → set → roll back just the changed field on error.
- Uploads (`useUploadGalleryPhotos`, `useUploadPortfolioPhoto`): refresh in `onSettled`,
  not `onSuccess` — a batch failing on file 3 has stored files 1–2.
- `staleTime` stays the app default (30s). Use `staleTime: 0` only when another screen
  writes the data without going through this hook's mutations, and say which in a comment.

**Screen**:
- `const q = useX(); const items = q.data ?? EMPTY` with a module-level `const EMPTY: T[] = []`
  (stable for memos). Loading = `q.isLoading` (false when disabled).
- Call `mutate(vars, { onSuccess, onError })`; screen-only effects (close dialog, select
  row, toast) go in those per-call callbacks. Destructure `const { mutate: mutateX } = m`
  when it goes into a `useCallback` dep list — the mutation object is new every render.
- Busy flags come from `m.isPending` (+ `m.variables` to know *which* row), never `useState`.
- **Errors**: held as `AsyncError` (`asyncError(err, 'surface.thing.error')`), rendered with
  `asyncErrorText`. Never `e.message` (axios always has one — "Request failed with status
  code 500"). A failed *action* gets its own state rendered **above the content**
  (`<Alert tone="danger">`); a failed *load* comes from `q.isError`. Do not route an
  action's error into state that only renders in an empty/loading branch or inside a
  form that cannot be open at that moment — galleries, portfolio and packages all had
  that bug.
- A confirm dialog closes on failure too, with the error shown outside it.

**Not here**: Server Components (`app/p/`, `app/r/`, `app/g/` pages) fetch with `fetch()`
on the server — React Query is client-only.

## Tests

- Unit: `*.test.ts(x)` next to the file. API-backed component: `*.msw.test.tsx` using
  `test-utils/msw.ts` + `test-utils/render.tsx` (provides QueryClient + locale).
- Moving a screen onto hooks: a `<surface>.msw.test.tsx` that pins the behaviour kept, plus
  one test per bug fixed — and run that test against the old file (`git show main:<path>`)
  to prove it fails there.
- A test that `jest.mock`s a whole hooks module must spread `jest.requireActual(...)`, or
  every export added later breaks it (see `dashboard-key-warnings.test.tsx`).
- E2E: `e2e/*.spec.ts` (Playwright) against `make e2e-stack` (:3001).
- Check: `npm run typecheck && npm run lint && npm test && npm run i18n:check`.
  **Not** `npm run build` while the dev server runs.
