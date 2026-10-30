# docs

Project documentation that does not belong in code.

## Structure

```
docs/
├── adr/     Architecture Decision Records
├── erd/     Entity Relationship Diagrams
└── api/     API contracts (OpenAPI / Swagger specs)
```

### adr/

Architecture Decision Records capture *why* a significant design choice was made,
not just what was chosen. Each ADR is a short Markdown file named
`NNN-short-title.md` (e.g. `001-use-postgresql.md`) and contains:
- **Context** — the situation that required a decision
- **Decision** — what was chosen
- **Consequences** — trade-offs accepted

Current records:
- [`001-gallery-retention-and-deletion.md`](adr/001-gallery-retention-and-deletion.md)
  — galleries expire (Starter 60 days / Pro 1 year / Studio 2 years). **Carries
  the four hard requirements that gate the deletion job.** Read before touching
  gallery expiry.

### erd/

Entity Relationship Diagrams illustrate the database schema.
Keep diagrams updated whenever the schema changes.

### api/

OpenAPI 3.x specifications (`openapi.yml`) that describe every REST endpoint,
request body, and response shape. Used to:
- Generate client code for `apps/web`
- Serve as the contract between frontend and backend teams
