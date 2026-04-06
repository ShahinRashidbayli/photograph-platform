# shared

Shared TypeScript types and utility functions used across the monorepo.

## Responsibilities

- Provide a single source of truth for data shapes shared between `apps/web` and any future TypeScript consumers
- Prevent type drift — the API contract is defined here, not duplicated per app

## Directory structure

```
src/
├── types/     TypeScript interfaces that mirror API request/response shapes
└── utils/     Pure utility functions with no framework dependencies
```

## Usage

Import from the package name in any workspace app:

```ts
import type { Photo, User } from '@photograph-platform/shared';
```

Make sure `apps/web/package.json` lists `"@photograph-platform/shared": "*"` as a dependency
and the root `package.json` declares npm workspaces.

## Building

```bash
npm run build      # compiles to dist/
npm run typecheck  # type-check without emitting files
```
