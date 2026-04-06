# web

Next.js 14 frontend for photograph-platform, using the App Router and TypeScript.

## Responsibilities

- Render pages and UI components for end users
- Communicate with `apps/api` over HTTP
- Handle client-side state, routing, and image display

## Directory structure

```
src/
├── app/            App Router pages and layouts (Next.js file-based routing)
├── components/
│   ├── ui/         Generic, reusable UI primitives (buttons, inputs, cards)
│   └── layout/     Page-level layout components (header, footer, sidebar)
├── hooks/          Custom React hooks
├── lib/            Utility functions, constants, configuration
├── services/       API client functions — all fetch() calls live here
└── types/          TypeScript interfaces and type aliases
```

## Environment variables

```
NEXT_PUBLIC_API_URL=http://localhost:8080   # base URL of the Spring Boot API
```

## Running locally

```bash
npm install
npm run dev
# App available at http://localhost:3000
```

## Available scripts

| Script          | Description                          |
|-----------------|--------------------------------------|
| `npm run dev`   | Start development server             |
| `npm run build` | Production build                     |
| `npm run start` | Serve the production build           |
| `npm run lint`  | Run ESLint                           |
| `npm test`      | Run Jest tests                       |
