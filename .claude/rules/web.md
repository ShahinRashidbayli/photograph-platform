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

- **Data fetching**: a hook in `hooks/`, never `api.get` inside a page for new code.
  Export the query-key function when another screen invalidates it (see `useInvoices.ts`).
- **UI**: use `components/ui` primitives for new/edited UI. Most old screens still
  hand-roll inline styles — migrate the part you touch, don't add new hand-rolled buttons/modals.
  No new styling library. Theme via `useColors()` / `useThemeStore`.
- **i18n**: no hardcoded user-visible strings. Add keys to both `locales/en/<surface>.ts`
  and `locales/de/<surface>.ts` (new surface → register in both `index.ts`). Keys are flat,
  dot-namespaced (`clients.filter.All`). `npm run i18n:check` catches placeholder/plural/orphan issues.
- **Plan gating**: whether this tenant *has* a capability → `useEntitlements` (server is
  authoritative). `lib/plan-gate.ts` only names which tier unlocks it. 402 → `PlanUpgradeDialog`.
- **Mobile**: `useMediaQuery` + `MobilePaneBack` for list/detail screens (see `clients/page.tsx`).
- **Redirects**: use `lib/safe-redirect.ts` / `lib/login-redirect.ts`, never raw `next` params.

## Tests

- Unit: `*.test.ts(x)` next to the file. API-backed component: `*.msw.test.tsx` using
  `test-utils/msw.ts` + `test-utils/render.tsx` (provides QueryClient + locale).
- E2E: `e2e/*.spec.ts` (Playwright) against `make e2e-stack` (:3001).
- Check: `npm run typecheck && npm run lint && npm test && npm run i18n:check`.
  **Not** `npm run build` while the dev server runs.
